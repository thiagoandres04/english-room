import {spawnSync} from 'node:child_process';
const r=spawnSync(process.execPath,[process.env.npm_execpath,'install','--no-frozen-lockfile'],{stdio:'inherit'});process.exit(r.status??1);
