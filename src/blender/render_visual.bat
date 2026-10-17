@echo off
rem Renders the Retail Park visualisation (step 3 of the accurate model: the material schedule's finishes, facades,
rem landscape, shade sails, food trucks, golden-hour light) on this PC's graphics card.
rem Rebuilds the scene from src\blender\massing.py with Blender 4.2 or newer (5.x works), saves it as
rem src\blender\RetailPark_visual.blend and writes the nine views to the "renders\visual" folder at the top of the repo.
setlocal
if not defined BLENDER set "BLENDER=C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
if not exist "%BLENDER%" (
  echo Blender not found at "%BLENDER%".
  echo Install Blender from https://www.blender.org/download/ or set BLENDER to your blender.exe path.
  pause
  exit /b 1
)
cd /d "%~dp0..\.."
if not exist "src\blender\plan\retail_park_plan.json" (
  echo The plan data isn't here: it is made from the project drawings and kept off the public repo.
  echo Run  python src\blender\plan\trace_plan.py "path\to\the setting-out plan.pdf"  first ^(see src\blender\README.md^),
  echo or open the .blend file you were sent and use Render ^> Render Animation.
  pause
  exit /b 1
)
"%BLENDER%" -b --factory-startup -P src\blender\massing.py -- --look visual --gpu --samples 256 --blend src\blender\RetailPark_visual.blend --out renders\visual
echo.
echo Done. The views are in renders\visual
pause
