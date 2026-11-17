$ErrorActionPreference = 'Stop'

function Invoke-Checked($Executable, $Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}

$sdk = $env:ANDROID_HOME
if (-not $sdk) { $sdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$jdk = $env:JAVA_HOME
if (-not $jdk) { $jdk = 'C:/Program Files/Android/Android Studio/jbr' }
$env:JAVA_HOME = $jdk
$bin = Join-Path $jdk 'bin'
$tools = Join-Path $sdk 'build-tools/35.0.0'
$androidJar = Join-Path $sdk 'platforms/android-34/android.jar'
$build = Join-Path $PSScriptRoot 'build'
$dist = Join-Path $PSScriptRoot 'dist'
$classes = Join-Path $build 'classes'
$dex = Join-Path $build 'dex'
New-Item -Force -ItemType Directory $dist, $classes, $dex | Out-Null
$manifest = Join-Path $PSScriptRoot 'android/AndroidManifest.xml'
$source = Join-Path $PSScriptRoot 'android/MainActivity.java'
$resources = Join-Path $PSScriptRoot 'android/res'
$archive = Join-Path $build 'classes.jar'
$unsigned = Join-Path $build 'unsigned.apk'
$aligned = Join-Path $build 'aligned.apk'
$apk = Join-Path $dist 'Pulse2BP.apk'
$key = Join-Path $build 'demo.keystore'

Invoke-Checked "$bin/javac.exe" @('--release', '8', '-classpath', $androidJar, '-d', $classes, $source)
Invoke-Checked "$bin/jar.exe" @("-J-Djava.io.tmpdir=$build", 'cf', $archive, '-C', $classes, '.')
Invoke-Checked "$tools/d8.bat" @('--lib', $androidJar, '--min-api', '23', '--output', $dex, $archive)
Invoke-Checked "$tools/aapt.exe" @('package', '-f', '-M', $manifest, '-S', $resources,
    '-I', $androidJar, '-F', $unsigned, $dex)
Invoke-Checked "$tools/zipalign.exe" @('-f', '4', $unsigned, $aligned)
if (-not (Test-Path -LiteralPath $key)) {
    Invoke-Checked "$bin/keytool.exe" @('-genkeypair', '-keystore', $key, '-storepass', 'android',
        '-keypass', 'android', '-alias', 'pulse2bp-demo', '-keyalg', 'RSA', '-keysize', '2048',
        '-validity', '10000', '-dname', 'CN=Pulse2BP Demo')
}
Invoke-Checked "$tools/apksigner.bat" @('sign', '--ks', $key, '--ks-pass', 'pass:android', '--out', $apk, $aligned)
Invoke-Checked "$tools/apksigner.bat" @('verify', '--verbose', $apk)
Write-Output $apk
