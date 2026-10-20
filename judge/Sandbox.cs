// Trusted Windows broker. Never run student code without this boundary.
// Build with the .NET Framework C# compiler; no downloaded runtime packages.
using System;
using System.IO;
using System.Text;
using System.Threading;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

public sealed class SandboxConfig {
    public string executable;
    public string arguments;
    public string workingDirectory;
    public string inputFile;
    public string resultFile;
    public string[] readRoots;
    public Dictionary<string, string> environment;
    public int timeoutMs = 2000;
    public int memoryMb = 256;
    public int processes = 1;
    public int outputBytes = 65536;
}
public sealed class SandboxResult {
    public string status;
    public int exitCode;
    public string stdout;
    public string stderr;
    public long elapsedMs;
}
public static class Sandbox {
    [StructLayout(LayoutKind.Sequential)]
    struct SECURITY_ATTRIBUTES { public int nLength; public IntPtr descriptor; public int inherit; }
    [StructLayout(LayoutKind.Sequential)]
    struct SECURITY_CAPABILITIES { public IntPtr sid; public IntPtr capabilities; public int count; public int reserved; }
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct STARTUPINFO {
        public int cb; public string reserved, desktop, title;
        public int x,y,xSize,ySize,xChars,yChars,fill,flags;
        public short show,reservedBytes; public IntPtr reserved2,input,output,error;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct STARTUPINFOEX { public STARTUPINFO startup; public IntPtr attributes; }
    [StructLayout(LayoutKind.Sequential)]
    struct PROCESS_INFORMATION { public IntPtr process,thread; public int pid,tid; }
    [StructLayout(LayoutKind.Sequential)]
    struct BASIC_LIMITS {
        public long processTime,jobTime; public uint flags;
        public UIntPtr minimumWorkingSet,maximumWorkingSet;
        public uint activeProcesses; public UIntPtr affinity; public uint priority,scheduling;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct IO_COUNTERS { public ulong a,b,c,d,e,f; }
    [StructLayout(LayoutKind.Sequential)]
    struct EXTENDED_LIMITS {
        public BASIC_LIMITS basic; public IO_COUNTERS io;
        public UIntPtr processMemory,jobMemory,peakProcess,peakJob;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct JOB_PORT { public IntPtr key,port; }
    [DllImport("userenv.dll", CharSet=CharSet.Unicode)]
    static extern int CreateAppContainerProfile(string name,string display,string description,IntPtr capabilities,int count,out IntPtr sid);
    [DllImport("userenv.dll", CharSet=CharSet.Unicode)]
    static extern int DeleteAppContainerProfile(string name);
    [DllImport("advapi32.dll")] static extern IntPtr FreeSid(IntPtr sid);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref IntPtr size);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,IntPtr size,IntPtr previous,IntPtr returned);
    [DllImport("kernel32.dll")] static extern void DeleteProcThreadAttributeList(IntPtr list);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern bool CreateProcess(string executable,StringBuilder command,IntPtr processAttrs,IntPtr threadAttrs,
        bool inherit,uint flags,IntPtr environment,string cwd,ref STARTUPINFOEX info,out PROCESS_INFORMATION process);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref SECURITY_ATTRIBUTES attrs,int size);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern IntPtr CreateJobObject(IntPtr attrs,string name);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool SetInformationJobObject(IntPtr job,int info,ref EXTENDED_LIMITS limits,int size);
    [DllImport("kernel32.dll",SetLastError=true,EntryPoint="SetInformationJobObject")]
    static extern bool SetJobPort(IntPtr job,int info,ref JOB_PORT port,int size);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern IntPtr CreateIoCompletionPort(IntPtr file,IntPtr existing,UIntPtr key,uint threads);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool GetQueuedCompletionStatus(IntPtr port,out uint message,out UIntPtr key,out IntPtr overlapped,uint timeout);
    [DllImport("kernel32.dll",SetLastError=true)]
    static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
    [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr job,uint exit);
    [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint exit);
    [DllImport("kernel32.dll")] static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
    [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr handle,out uint exit);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] static extern uint SetErrorMode(uint mode);

    sealed class Capture {
        public int total;
        public volatile bool exceeded;
        public MemoryStream output = new MemoryStream();
        public MemoryStream error = new MemoryStream();
        public Thread Start(IntPtr handle, MemoryStream destination, int max) {
            Thread thread = new Thread(delegate() {
                using (FileStream stream = new FileStream(new SafeFileHandle(handle,true),FileAccess.Read)) {
                    byte[] buffer = new byte[4096];
                    try {
                        int read;
                        while ((read = stream.Read(buffer,0,buffer.Length)) > 0) {
                            int count = Interlocked.Add(ref total,read);
                            if (count > max) { exceeded=true; break; }
                            destination.Write(buffer,0,read);
                        }
                    } catch (IOException) { }
                }
            });
            thread.IsBackground=true; thread.Start(); return thread;
        }
    }
    static void Check(bool success,string operation) {
        if (!success) throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error(),operation);
    }
    static bool MemoryExceeded(IntPtr port) {
        uint message; UIntPtr key; IntPtr process;
        for(int i=0;i<256 && GetQueuedCompletionStatus(port,out message,out key,out process,0);i++)
            if(message==9 || message==10) return true;
        return false;
    }
    static void Grant(string path,SecurityIdentifier sid,FileSystemRights rights) {
        DirectoryInfo directory=new DirectoryInfo(path);
        DirectorySecurity acl=directory.GetAccessControl();
        acl.AddAccessRule(new FileSystemAccessRule(sid,rights,
            InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));
        directory.SetAccessControl(acl);
    }
    static void Revoke(string path, SecurityIdentifier sid) {
        if (!Directory.Exists(path)) return;
        DirectoryInfo directory=new DirectoryInfo(path);
        DirectorySecurity acl=directory.GetAccessControl();
        acl.PurgeAccessRules(sid); directory.SetAccessControl(acl);
    }
    static IntPtr EnvironmentBlock(Dictionary<string,string> values) {
        SortedDictionary<string,string> sorted=new SortedDictionary<string,string>(values,StringComparer.OrdinalIgnoreCase);
        StringBuilder text=new StringBuilder();
        foreach (KeyValuePair<string,string> item in sorted) {
            if (item.Key.IndexOfAny(new char[]{'=','\0'}) >= 0 || item.Value.Contains("\0"))
                throw new Exception("Invalid environment");
            text.Append(item.Key).Append('=').Append(item.Value).Append('\0');
        }
        text.Append('\0');
        return Marshal.StringToHGlobalUni(text.ToString());
    }
    static SandboxResult Run(SandboxConfig config) {
        string profile="CppRoom."+Guid.NewGuid().ToString("N");
        IntPtr sid=IntPtr.Zero,attrs=IntPtr.Zero,capsPointer=IntPtr.Zero,handlesPointer=IntPtr.Zero;
        IntPtr environment=IntPtr.Zero,job=IntPtr.Zero,port=IntPtr.Zero,outRead=IntPtr.Zero,outWrite=IntPtr.Zero,errRead=IntPtr.Zero,errWrite=IntPtr.Zero;
        PROCESS_INFORMATION process=new PROCESS_INFORMATION();
        SecurityIdentifier identity=null;
        bool profileCreated=false,attributesCreated=false;
        Capture capture=new Capture();
        Thread outThread=null,errThread=null;
        var watch=System.Diagnostics.Stopwatch.StartNew();
        var result=new SandboxResult {status="sandbox_error",exitCode=-1,stdout="",stderr=""};
        try {
            SetErrorMode(0x0001|0x0002|0x8000); // Child failures must not open interactive Windows dialogs.
            int hr=CreateAppContainerProfile(profile,profile,"C++ coursework sandbox",IntPtr.Zero,0,out sid);
            if (hr!=0) Marshal.ThrowExceptionForHR(hr);
            profileCreated=true; identity=new SecurityIdentifier(sid);
            Grant(config.workingDirectory,identity,FileSystemRights.Modify|FileSystemRights.Synchronize);
            foreach(string root in config.readRoots) Grant(root,identity,FileSystemRights.ReadAndExecute);
            // Only the owned work directory receives a low-integrity label.
            var label=System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo {
                FileName=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System),"icacls.exe"),
                Arguments="\""+config.workingDirectory+"\" /setintegritylevel (OI)(CI)L /T /Q",
                UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true
            });
            label.StandardOutput.ReadToEnd(); label.StandardError.ReadToEnd(); label.WaitForExit();
            if(label.ExitCode!=0) throw new Exception("Cannot set owned directory integrity");

            SECURITY_ATTRIBUTES security=new SECURITY_ATTRIBUTES {nLength=Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)),inherit=1};
            Check(CreatePipe(out outRead,out outWrite,ref security,0),"stdout pipe");
            Check(CreatePipe(out errRead,out errWrite,ref security,0),"stderr pipe");
            Check(SetHandleInformation(outRead,1,0),"stdout read inheritance");
            Check(SetHandleInformation(errRead,1,0),"stderr read inheritance");
            using(FileStream input=new FileStream(config.inputFile,FileMode.Open,FileAccess.Read,FileShare.Read)) {
                IntPtr inputHandle=input.SafeFileHandle.DangerousGetHandle();
                Check(SetHandleInformation(inputHandle,1,1),"stdin inheritance");
                IntPtr size=IntPtr.Zero;
                InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
                attrs=Marshal.AllocHGlobal(size);
                Check(InitializeProcThreadAttributeList(attrs,2,0,ref size),"attribute initialization");
                attributesCreated=true;
                SECURITY_CAPABILITIES caps=new SECURITY_CAPABILITIES {sid=sid};
                capsPointer=Marshal.AllocHGlobal(Marshal.SizeOf(caps)); Marshal.StructureToPtr(caps,capsPointer,false);
                Check(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20009),capsPointer,new IntPtr(Marshal.SizeOf(caps)),IntPtr.Zero,IntPtr.Zero),"AppContainer attribute");
                handlesPointer=Marshal.AllocHGlobal(IntPtr.Size*3);
                Marshal.Copy(new IntPtr[]{inputHandle,outWrite,errWrite},0,handlesPointer,3);
                Check(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20002),handlesPointer,new IntPtr(IntPtr.Size*3),IntPtr.Zero,IntPtr.Zero),"handle whitelist");
                job=CreateJobObject(IntPtr.Zero,null);
                Check(job!=IntPtr.Zero,"job creation");
                port=CreateIoCompletionPort(new IntPtr(-1),IntPtr.Zero,UIntPtr.Zero,1);
                Check(port!=IntPtr.Zero,"job notification port");
                JOB_PORT association=new JOB_PORT {key=new IntPtr(1),port=port};
                Check(SetJobPort(job,7,ref association,Marshal.SizeOf(association)),"job port association");
                EXTENDED_LIMITS limits=new EXTENDED_LIMITS();
                limits.basic.flags=0x2000|0x200|0x8|0x4; // kill-on-close, job memory, process count, job CPU time
                limits.basic.activeProcesses=(uint)config.processes;
                limits.basic.jobTime=(long)(config.timeoutMs+1000)*10000;
                limits.jobMemory=new UIntPtr((ulong)config.memoryMb*1024*1024);
                Check(SetInformationJobObject(job,9,ref limits,Marshal.SizeOf(limits)),"job limits");
                environment=EnvironmentBlock(config.environment);
                STARTUPINFOEX startup=new STARTUPINFOEX();
                startup.startup.cb=Marshal.SizeOf(startup); startup.startup.flags=0x100;
                startup.startup.input=inputHandle; startup.startup.output=outWrite; startup.startup.error=errWrite;
                startup.attributes=attrs;
                StringBuilder command=new StringBuilder("\""+config.executable+"\" "+config.arguments);
                Check(CreateProcess(config.executable,command,IntPtr.Zero,IntPtr.Zero,true,0x80000|0x4|0x400|0x08000000,
                    environment,config.workingDirectory,ref startup,out process),"AppContainer process creation");
                Check(AssignProcessToJobObject(job,process.process),"job assignment");
                CloseHandle(outWrite); outWrite=IntPtr.Zero; CloseHandle(errWrite); errWrite=IntPtr.Zero;
                outThread=capture.Start(outRead,capture.output,config.outputBytes); outRead=IntPtr.Zero;
                errThread=capture.Start(errRead,capture.error,config.outputBytes); errRead=IntPtr.Zero;
                if(ResumeThread(process.thread)==uint.MaxValue) throw new Exception("Process resume failed");
                watch.Restart();
                result.status="ok";
                while(WaitForSingleObject(process.process,10)==0x102) {
                    if(MemoryExceeded(port)) {result.status="memory_limit";break;}
                    if(capture.exceeded) {result.status="output_limit";break;}
                    if(watch.ElapsedMilliseconds>config.timeoutMs) {result.status="time_limit";break;}
                }
                if(MemoryExceeded(port)) result.status="memory_limit";
                result.elapsedMs=watch.ElapsedMilliseconds;
                uint exit;
                GetExitCodeProcess(process.process,out exit); result.exitCode=unchecked((int)exit);
                TerminateJobObject(job,1); // Also kills any child still holding an output handle.
                WaitForSingleObject(process.process,2000);
                outThread.Join(2000); errThread.Join(2000);
                if(capture.exceeded && result.status=="ok") result.status="output_limit";
                else if(result.status=="ok" && result.exitCode!=0) result.status="runtime_error";
                result.stdout=Encoding.UTF8.GetString(capture.output.ToArray());
                result.stderr=Encoding.UTF8.GetString(capture.error.ToArray());
            }
        } catch(Exception error) {
            var native=error as System.ComponentModel.Win32Exception;
            result.status="sandbox_error"; result.stderr=error.Message+(native==null ? "" : " (Win32 "+native.NativeErrorCode+")");
        } finally {
            if(process.process!=IntPtr.Zero) TerminateProcess(process.process,1);
            if(job!=IntPtr.Zero) {TerminateJobObject(job,1);CloseHandle(job);}
            if(port!=IntPtr.Zero) CloseHandle(port);
            foreach(IntPtr handle in new IntPtr[]{process.thread,process.process,outRead,outWrite,errRead,errWrite})
                if(handle!=IntPtr.Zero) CloseHandle(handle);
            if(outThread!=null) outThread.Join(2000);
            if(errThread!=null) errThread.Join(2000);
            if(attributesCreated) DeleteProcThreadAttributeList(attrs);
            foreach(IntPtr pointer in new IntPtr[]{attrs,capsPointer,handlesPointer,environment})
                if(pointer!=IntPtr.Zero) Marshal.FreeHGlobal(pointer);
            if(identity!=null) {
                // Never propagate ACL changes through a tree touched by student code.
                // The work tree is removed by the broker's no-follow cleanup.
                foreach(string root in config.readRoots) {try {Revoke(root,identity);} catch { }}
            }
            if(sid!=IntPtr.Zero) FreeSid(sid);
            if(profileCreated) DeleteAppContainerProfile(profile);
        }
        return result;
    }
    public static int Main(string[] args) {
        if(args.Length!=1) return 2;
        try {
            JavaScriptSerializer json=new JavaScriptSerializer {MaxJsonLength=1048576};
            SandboxConfig config=json.Deserialize<SandboxConfig>(File.ReadAllText(args[0],Encoding.UTF8));
            SandboxResult result=Run(config);
            File.WriteAllText(config.resultFile,json.Serialize(result),new UTF8Encoding(false));
            return result.status=="sandbox_error" ? 3 : 0;
        } catch(Exception error) {Console.Error.WriteLine("Broker configuration error: "+error.Message);return 4;}
    }
}
