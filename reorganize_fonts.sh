#!/bin/bash

# Script to reorganize fonts into public/fonts directory

cd "$(dirname "$0")"

# Create fonts directory if it doesn't exist
mkdir -p public/fonts

# Move Elms_Sans
if [ -d "public/Elms_Sans" ]; then
  mv public/Elms_Sans public/fonts/Elms_Sans
  echo "✓ Moved Elms_Sans to public/fonts/Elms_Sans"
fi

# Move mulish
if [ -d "public/mulish" ]; then
  mv public/mulish public/fonts/mulish
  echo "✓ Moved mulish to public/fonts/mulish"
fi

# Move Zen_Maru_Gothic
if [ -d "public/Zen_Maru_Gothic" ]; then
  mv public/Zen_Maru_Gothic public/fonts/Zen_Maru_Gothic
  echo "✓ Moved Zen_Maru_Gothic to public/fonts/Zen_Maru_Gothic"
fi

# Move Playwrite_HU from the combined folder
if [ -d "public/Elms_Sans,Playwrite_HU/Playwrite_HU" ]; then
  mv "public/Elms_Sans,Playwrite_HU/Playwrite_HU" public/fonts/Playwrite_HU
  echo "✓ Moved Playwrite_HU to public/fonts/Playwrite_HU"
  
  # Remove the combined folder if it exists
  if [ -d "public/Elms_Sans,Playwrite_HU" ]; then
    rm -rf "public/Elms_Sans,Playwrite_HU"
    echo "✓ Removed Elms_Sans,Playwrite_HU folder"
  fi
fi

echo ""
echo "Font reorganization complete!"
echo "All fonts are now in public/fonts/"

