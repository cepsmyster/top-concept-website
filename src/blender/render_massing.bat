@echo off
rem Renders the Retail Park massing (white blocks) in its desert setting (steps 1 and 2 of the accurate model) on this
rem PC's graphics card. For the finished visualisation (step 3) use render_visual.bat.
rem Rebuilds the scene from src\blender\massing.py with Blender 4.2 or newer (5.x works), saves it as
rem src\blender\RetailPark_massing.blend and writes the seven views to the "renders\massing" folder at the top of the repo.
setlocal
if not defined BLENDER set "BLENDER=C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
if not exist "%BLENDER%" (
  echo Blender not found at "%BLENDER%".
  echo Install Blender from https://www.blender.org/download/ or set BLENDER to your blender.exe path.
  pause
  exit /b 1
)
cd /d "%~dp0..\.."
"%BLENDER%" -b --factory-startup -P src\blender\massing.py -- --look massing --gpu --samples 128 --blend src\blender\RetailPark_massing.blend --out renders\massing
echo.
echo Done. The views are in renders\massing
pause
