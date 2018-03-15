#!/bin/bash
filename=".env.dev"
echo "Exporting ...";
while IFS= read -r line; do
  echo $line;
  export $line;
done < "$filename"
echo "Done."
