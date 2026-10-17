@echo off
rem Renders the Retail Park massing (step 1 of the accurate model) on this PC's graphics card.
rem Rebuilds the scene from src\blender\massing.py with Blender 4.2 or newer (5.x works), saves it as
rem src\blender\RetailPark_massing.blend and writes the six views to the "renders\massing" folder at the top of the repo.
setlocal
if not defined BLENDER set "BLENDER=C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
if not exist "%BLENDER%" (
  echo Blender not found at "%BLENDER%".
  echo Install Blender from https://www.blender.org/download/ or set BLENDER to your blender.exe path.
  pause
  exit /b 1
)
cd /d "%~dp0..\.."
"%BLENDER%" -b --factory-startup -P src\blender\massing.py -- --gpu --samples 128 --blend src\blender\RetailPark_massing.blend --out renders\massing
echo.
echo Done. The views are in renders\massing
pause
