@echo off
rem Renders the Retail Park 3D tour on this PC's graphics card with Blender 4.2 or newer (5.x works).
rem Double-click this file (or run it from a terminal). Output: the "renders" folder at the top of the repo.
rem Already-finished frames are skipped, so you can stop and start again at any time.
setlocal
if not defined BLENDER set "BLENDER=C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
if not exist "%BLENDER%" (
  echo Blender not found at "%BLENDER%".
  echo Install Blender from https://www.blender.org/download/ or set BLENDER to your blender.exe path.
  pause
  exit /b 1
)
cd /d "%~dp0..\.."
set "SCRIPT=src\blender\retail_park.py"
"%BLENDER%" -b --factory-startup -P %SCRIPT% -- --gpu --format webp --light day   --tour 8 --path 24 --no-traffic --samples 128 --out renders\day
"%BLENDER%" -b --factory-startup -P %SCRIPT% -- --gpu --format webp --light night --tour 8 --path 24 --no-traffic --samples 128 --out renders\night
echo.
echo Done. Next: node src\blender\export_tour.mjs renders  (see src\blender\README.md)
pause
