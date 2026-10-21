# Cria um certificado autoassinado de assinatura de codigo (uso proprio) em certs/.
# Gera gestao-motorista.pfx (chave privada, NAO versionar), gestao-motorista.cer (publico) e senha.txt.
# Uso: powershell -ExecutionPolicy Bypass -File scripts/criar-certificado.ps1
$ErrorActionPreference = 'Stop'
$pasta = Join-Path (Split-Path $PSScriptRoot -Parent) 'certs'
New-Item -ItemType Directory -Force $pasta | Out-Null
$pfx = Join-Path $pasta 'gestao-motorista.pfx'
if (Test-Path $pfx) { throw "Ja existe $pfx. Apague os arquivos de certs/ para gerar outro." }

$senhaTexto = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 24 | ForEach-Object { [char]$_ })
$senha = ConvertTo-SecureString $senhaTexto -AsPlainText -Force
$cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=Gestao do Motorista' `
  -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(5) -CertStoreLocation 'Cert:\CurrentUser\My'

Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $senha | Out-Null
Export-Certificate -Cert $cert -FilePath (Join-Path $pasta 'gestao-motorista.cer') | Out-Null
Set-Content -Path (Join-Path $pasta 'senha.txt') -Value $senhaTexto -Encoding ascii -NoNewline
Remove-Item "Cert:\CurrentUser\My\$($cert.Thumbprint)"   # fica so nos arquivos
Write-Host "Certificado criado em $pasta (valido ate $($cert.NotAfter.ToString('dd/MM/yyyy')))."
