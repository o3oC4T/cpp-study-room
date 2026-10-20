$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$Utf8 = New-Object System.Text.UTF8Encoding($false)

function Copy-JudgeTree([string]$From, [string]$To) {
    if (-not (Test-Path -LiteralPath $From -PathType Container)) { throw "Missing tool directory: $From" }
    & "$env:WINDIR\System32\robocopy.exe" $From $To /E /NFL /NDL /NJH /NJS /NP /R:1 /W:1 | Out-Null
    if ($LASTEXITCODE -ge 8) { throw 'Tool copy failed' }
}

function Initialize-Judge([string]$Root) {
    New-Item -ItemType Directory -Force -Path $Root | Out-Null
    $toolRoot = Join-Path $Root 'tools'
    $broker = Join-Path $Root 'Sandbox.exe'
    & "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe" /nologo /optimize+ /r:System.Web.Extensions.dll "/out:$broker" (Join-Path $PSScriptRoot 'Sandbox.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Sandbox broker compilation failed' }
    # Copy only compiler/runtime assets to an owned temporary directory.
    # No ACL changes are made to the installed Visual Studio or Windows SDK.
    if (-not (Test-Path (Join-Path $toolRoot 'ready.txt'))) {
        $sdkVersion = $env:WindowsSDKVersion.TrimEnd('\')
        Copy-JudgeTree (Join-Path $env:VCToolsInstallDir 'bin\Hostx64\x64') (Join-Path $toolRoot 'bin')
        Copy-JudgeTree (Join-Path $env:VCToolsInstallDir 'include') (Join-Path $toolRoot 'include')
        Copy-JudgeTree (Join-Path $env:VCToolsInstallDir 'lib\x64') (Join-Path $toolRoot 'lib')
        foreach ($part in @('ucrt','um','shared')) {
            Copy-JudgeTree (Join-Path $env:WindowsSdkDir "Include\$sdkVersion\$part") (Join-Path $toolRoot "sdk\include\$part")
        }
        foreach ($part in @('ucrt','um')) {
            Copy-JudgeTree (Join-Path $env:WindowsSdkDir "Lib\$sdkVersion\$part\x64") (Join-Path $toolRoot "sdk\lib\$part")
        }
        $debugCrt = Get-ChildItem (Join-Path $env:VCToolsRedistDir 'debug_nonredist\x64') -Directory -Filter '*.DebugCRT' | Select-Object -First 1
        if (-not $debugCrt) { throw 'MSVC debug runtime unavailable' }
        Copy-JudgeTree $debugCrt.FullName (Join-Path $toolRoot 'runtime')
        $ucrt = Join-Path $env:WindowsSdkDir "bin\$sdkVersion\x64\ucrt\ucrtbased.dll"
        if (-not (Test-Path $ucrt)) { throw 'UCRT debug runtime unavailable' }
        Copy-Item -LiteralPath $ucrt -Destination (Join-Path $toolRoot 'runtime')
        [IO.File]::WriteAllText((Join-Path $toolRoot 'ready.txt'),$sdkVersion,$Utf8)
    }
    return @{ Root=$Root; Tools=$toolRoot; Broker=$broker }
}

function Invoke-Isolated($Judge, [string]$Work, [string]$Exe, [string]$Arguments, [string]$InputText, [bool]$Compile=$false) {
    $id = [Guid]::NewGuid().ToString('N')
    $inputPath = Join-Path $Judge.Root "$id.input"
    $resultPath = Join-Path $Judge.Root "$id.result.json"
    $configPath = Join-Path $Judge.Root "$id.config.json"
    [IO.File]::WriteAllText($inputPath,$InputText,$Utf8)
    $toolRoot = $Judge.Tools
    $environment = @{
        SystemRoot=$env:SystemRoot; WINDIR=$env:WINDIR; SystemDrive=$env:SystemDrive;
        LOCALAPPDATA=$env:LOCALAPPDATA
        PATH="$(Join-Path $toolRoot 'runtime');$env:WINDIR\System32"
        TEMP=$Work; TMP=$Work; VSLANG='1033'
    }
    if ($Compile) {
        $environment.PATH = "$(Join-Path $toolRoot 'bin');" + $environment.PATH
        $environment.INCLUDE = "$(Join-Path $toolRoot 'include');$(Join-Path $toolRoot 'sdk\include\ucrt');$(Join-Path $toolRoot 'sdk\include\um');$(Join-Path $toolRoot 'sdk\include\shared')"
        $environment.LIB = "$(Join-Path $toolRoot 'lib');$(Join-Path $toolRoot 'sdk\lib\ucrt');$(Join-Path $toolRoot 'sdk\lib\um')"
    }
    $readRoot = if($Compile){$toolRoot}else{Join-Path $toolRoot 'runtime'}
    $config = @{
        executable=$Exe; arguments=$Arguments; workingDirectory=$Work; inputFile=$inputPath; resultFile=$resultPath
        readRoots=@($readRoot); environment=$environment
        timeoutMs=$(if($Compile){45000}else{2000})
        memoryMb=$(if($Compile){1024}else{256})
        processes=$(if($Compile){12}else{1})
        outputBytes=65536
    }
    [IO.File]::WriteAllText($configPath,($config|ConvertTo-Json -Depth 8),$Utf8)
    try {
        & $Judge.Broker $configPath
        if (-not (Test-Path $resultPath)) { throw "Sandbox broker did not return a result (exit $LASTEXITCODE)" }
        $result = Get-Content -Raw -Encoding UTF8 $resultPath | ConvertFrom-Json
        if ($result.status -eq 'sandbox_error') { throw "Sandbox unavailable: $($result.stderr)" }
        return $result
    } finally {
        Remove-Item -LiteralPath $inputPath,$resultPath,$configPath -Force -ErrorAction SilentlyContinue
    }
}

function Compile-Submission($Judge,[string]$Source,[string]$Work) {
    New-Item -ItemType Directory -Force -Path $Work | Out-Null
    Copy-Item -LiteralPath $Source -Destination (Join-Path $Work 'main.cpp')
    $exe = Join-Path $Judge.Tools 'bin\cl.exe'
    return Invoke-Isolated $Judge $Work $exe '/nologo /utf-8 /EHsc /W3 /Od /MDd /permissive- /Fe:main.exe /Fo:main.obj main.cpp' '' $true
}

function Remove-JudgeWork([string]$Path) {
    # A submission may create a junction. Never recursively follow reparse points.
    $entry = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if (-not $entry) {return}
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        if ($entry.PSIsContainer) {[IO.Directory]::Delete($entry.FullName,$false)}
        else {[IO.File]::Delete($entry.FullName)}
        return
    }
    if ($entry.PSIsContainer) {
        foreach($child in Get-ChildItem -LiteralPath $Path -Force) {Remove-JudgeWork $child.FullName}
        [IO.Directory]::Delete($Path,$false)
    } else {[IO.File]::Delete($Path)}
}
