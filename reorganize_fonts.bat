@echo off
REM Script to reorganize fonts into public/fonts directory

cd /d "%~dp0"

REM Create fonts directory if it doesn't exist
if not exist "public\fonts" mkdir "public\fonts"

REM Move Elms_Sans
if exist "public\Elms_Sans" (
  move "public\Elms_Sans" "public\fonts\Elms_Sans"
  echo ✓ Moved Elms_Sans to public/fonts/Elms_Sans
)

REM Move mulish
if exist "public\mulish" (
  move "public\mulish" "public\fonts\mulish"
  echo ✓ Moved mulish to public/fonts/mulish
)

REM Move Zen_Maru_Gothic
if exist "public\Zen_Maru_Gothic" (
  move "public\Zen_Maru_Gothic" "public\fonts\Zen_Maru_Gothic"
  echo ✓ Moved Zen_Maru_Gothic to public/fonts/Zen_Maru_Gothic
)

REM Move Playwrite_HU from the combined folder
if exist "public\Elms_Sans,Playwrite_HU\Playwrite_HU" (
  move "public\Elms_Sans,Playwrite_HU\Playwrite_HU" "public\fonts\Playwrite_HU"
  echo ✓ Moved Playwrite_HU to public/fonts/Playwrite_HU
  
  REM Remove the combined folder if it exists
  if exist "public\Elms_Sans,Playwrite_HU" (
    rmdir /s /q "public\Elms_Sans,Playwrite_HU"
    echo ✓ Removed Elms_Sans,Playwrite_HU folder
  )
)

echo.
echo Font reorganization complete!
echo All fonts are now in public/fonts/
pause

