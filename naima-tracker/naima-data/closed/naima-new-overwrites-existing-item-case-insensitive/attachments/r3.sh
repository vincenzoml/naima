H=$PWD; rm -rf race && mkdir -p race/naima-tracker/naima-data && cd race && git init -q -b main
printf '{"format":1,"source":"https://example.invalid/n.git","commit":"%s"}\n' 0000000000000000000000000000000000000000 > naima-tracker/naima-data/naima.json
for i in 1 2 3 4 5 6 7 8; do deno run -A $H/r3.ts "$PWD" > out.$i 2>&1 & done; wait
echo "ids printed:"; cat out.* | awk '{print $2}' | sort -u | wc -l
echo "item dirs:"; ls naima-tracker/naima-data/bugs
echo "distinct ids on disk:"; cat naima-tracker/naima-data/bugs/*/meta.json | grep '"id"' | sort -u | wc -l
