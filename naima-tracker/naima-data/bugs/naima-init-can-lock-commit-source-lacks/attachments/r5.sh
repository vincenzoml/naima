export GIT_AUTHOR_NAME=a GIT_AUTHOR_EMAIL=a@b GIT_COMMITTER_NAME=a GIT_COMMITTER_EMAIL=a@b GIT_CONFIG_GLOBAL=/dev/null
H=$PWD; rm -rf i5 && mkdir i5 && cd i5
git init -q --bare src.git && git clone -q src.git seed 2>/dev/null && (cd seed && echo 1 > f && git add f && git commit -qm one && git push -q origin HEAD:main)
git clone -q src.git prog && (cd prog && echo 2 > f && git commit -qam "local only")
git init -q -b main proj && git init -q -b main other
deno run -A $H/r5.ts $PWD/proj $PWD/prog $PWD/other
