param(
    [Parameter(Mandatory=$true)][string]$Repository,
    [Parameter(Mandatory=$true)][string]$WorkRoot,
    [Parameter(Mandatory=$true)][string]$CommitSha,
    [Parameter(Mandatory=$true)][string]$ResultFile
)
. (Join-Path $PSScriptRoot 'common.ps1')
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $Repository 'current.json') | ConvertFrom-Json
if ($manifest.schema -ne 1 -or $manifest.submissionId -notmatch '^[0-9a-f-]{36}$' -or
    $manifest.problemId -notmatch '^midterm-[1-4]$' -or $manifest.mode -notin @('sample','full','counterexample') -or
    $manifest.source -ne "submissions/$($manifest.submissionId)/main.cpp" -or $CommitSha -notmatch '^[0-9a-f]{40}$') {
    throw 'Invalid coursework manifest'
}
$report = @{
    schema=1; submissionId=$manifest.submissionId; problemId=$manifest.problemId
    mode=$manifest.mode; commitSha=$CommitSha; status='system_error'; tests=@(); message=''; tested=0
}
try {
    $judge = Initialize-Judge $WorkRoot
    $build = Join-Path $WorkRoot 'compile'
    $compilation = Compile-Submission $judge (Join-Path $Repository $manifest.source) $build
    if ($compilation.status -ne 'ok') {
        $report.status='compile_error'
        $report.message=($compilation.stdout+$compilation.stderr).Substring(0,[Math]::Min(16000,($compilation.stdout+$compilation.stderr).Length))
    } else {
        if($manifest.mode -eq 'counterexample') {
            $generated=Join-Path $WorkRoot 'counterexamples.json'
            & node (Join-Path $PSScriptRoot 'counterexamples.mjs') --problem $manifest.problemId --seed $CommitSha.Substring(0,8) --output $generated
            if($LASTEXITCODE -ne 0) {throw 'Counterexample generator failed'}
            $cases=Get-Content -Raw -Encoding UTF8 $generated|ConvertFrom-Json
        } else {
            $cases = Get-Content -Raw -Encoding UTF8 (Join-Path $Repository "cases\$($manifest.problemId).json") | ConvertFrom-Json
        }
        if ($manifest.mode -eq 'sample') { $cases=@($cases|Where-Object {$_.sample}) }
        if ($cases.Count -lt 1 -or $cases.Count -gt 64) {throw 'Invalid case count'}
        if (@($cases|Where-Object {$_.sample}).Count -gt 4) {throw 'Too many sample cases'}
        foreach($case in $cases) {if($case.sample -and $case.output.Length -gt 4096){throw 'Sample output too large'}}
        $report.status='accepted'
        foreach ($case in $cases) {
            $work = Join-Path $WorkRoot ([Guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $work | Out-Null
            Copy-Item (Join-Path $build 'main.exe') (Join-Path $work 'main.exe')
            try {
                $execution = Invoke-Isolated $judge $work (Join-Path $work 'main.exe') '' $case.input
                $status=$execution.status
                if ($status -eq 'ok') {
                    $actual=$execution.stdout.Replace("`r`n","`n")
                    $expected=$case.output.Replace("`r`n","`n")
                    $status=if($actual -ceq $expected){'accepted'}else{'wrong_answer'}
                }
                $report.tested++
                if($manifest.mode -eq 'counterexample') {
                    if($status -ne 'accepted') {
                        $report.status='counterexample_found'
                        $report.tests=@(@{
                            status=$status;sample=$false;counterexample=$true;input=$case.input;expected=$case.output
                            actual=$execution.stdout.Substring(0,[Math]::Min(4096,$execution.stdout.Length))
                            truncated=$execution.stdout.Length -gt 4096
                        })
                        break
                    }
                    continue
                }
                if ($status -ne 'accepted' -and $report.status -eq 'accepted') {$report.status=$status}
                $item=@{status=$status;sample=[bool]$case.sample}
                if($case.sample) {
                    $item.expected=$case.output
                    $item.actual=$execution.stdout.Substring(0,[Math]::Min(4096,$execution.stdout.Length))
                    $item.truncated=$execution.stdout.Length -gt 4096
                }
                $report.tests+= $item
            } finally { Remove-JudgeWork $work }
        }
        if($manifest.mode -eq 'counterexample' -and $report.status -eq 'accepted') {$report.status='no_counterexample'}
    }
} catch {
    $report.status='system_error'
    $report.message='The Windows sandbox or judge could not complete. Contact the room owner.'
    Write-Error -ErrorAction Continue $_
} finally {
    $parent=Split-Path -Parent $ResultFile
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    $serialized=$report|ConvertTo-Json -Depth 10 -Compress
    if($Utf8.GetByteCount($serialized) -gt 250000) {
        $report.status='system_error';$report.tests=@();$report.message='Judge report exceeded the maximum size.'
        $serialized=$report|ConvertTo-Json -Depth 10 -Compress
    }
    [IO.File]::WriteAllText($ResultFile,$serialized,$Utf8)
}
if($report.status -eq 'system_error') {exit 1}
