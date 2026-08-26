$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

$downloads = @{
  "data/pacific-climate-fingerprints/raw/noaa_oni.ascii.txt" = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
  "data/pacific-climate-fingerprints/raw/noaa_co2_annmean_mlo.txt" = "https://gml.noaa.gov/webdata/ccgg/trends/co2/co2_annmean_mlo.txt"
  "data/pacific-climate-fingerprints/raw/27_DF_NMDI_POP_A_NMDI0001_T_T_T_T_Z.csv" = "https://stats-nsi-stable.pacificdata.org/rest/v1/data/SPC,DF_NMDI_POP,1.0/A..NMDI0001._T._T._T._T._Z"
}

foreach ($relativeTarget in $downloads.Keys) {
  $target = Join-Path $projectRoot $relativeTarget
  $headers = if ($target.EndsWith(".csv")) { @{ Accept = "text/csv" } } else { @{} }
  Invoke-WebRequest -Uri $downloads[$relativeTarget] -Headers $headers -OutFile $target -UseBasicParsing
}

python (Join-Path $PSScriptRoot "prepare_context_data.py")
