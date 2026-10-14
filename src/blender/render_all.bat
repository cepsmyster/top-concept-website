@echo off
rem Renders the Retail Park 3D page on this PC's graphics card with Blender 4.5.
rem Double-click this file (or run it from a terminal). Output: the "renders" folder at the top of the repo.
rem Already-finished frames are skipped, so you can stop and start again at any time.
setlocal
if not defined BLENDER set "BLENDER=C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
if not exist "%BLENDER%" (
  echo Blender 4.5 not found at "%BLENDER%".
  echo Install Blender 4.5 LTS from https://www.blender.org/download/lts/4-5/ or set BLENDER to your blender.exe path.
  pause
  exit /b 1
)
cd /d "%~dp0..\.."
set "SCRIPT=src\blender\retail_park.py"
"%BLENDER%" -b --factory-startup -P %SCRIPT% -- --gpu --format webp --light day   --orbit 60 --samples 128 --out renders\day
"%BLENDER%" -b --factory-startup -P %SCRIPT% -- --gpu --format webp --light night --orbit 60 --samples 128 --out renders\night
"%BLENDER%" -b --factory-startup -P %SCRIPT% -- --gpu --format webp --light day   --orbit 60 --loop 48 --at 0 --samples 96 --out renders\day_loop
"%BLENDER%" -b --factory-startup -P %SCRIPT% -- --gpu --format webp --light night --orbit 60 --loop 48 --at 0 --samples 96 --out renders\night_loop
echo.
echo Done. Upload the "renders" folder (see src\blender\README.md).
pause
