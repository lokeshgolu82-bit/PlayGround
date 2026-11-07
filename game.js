import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#world');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9d8d1');
scene.fog = new THREE.Fog('#a9d8d1', 18, 54);
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

scene.add(new THREE.HemisphereLight('#e9fff7', '#687c53', 2.15));
const sun = new THREE.DirectionalLight('#fff1ce', 3.1);
sun.position.set(-12, 22, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -24; sun.shadow.camera.right = 24;
sun.shadow.camera.top = 24; sun.shadow.camera.bottom = -24;
sun.shadow.bias = -0.0004;
scene.add(sun);

const blockDefs = [
  { id: 'grass', name: 'Grass', color: '#83b86d', count: 12 },
  { id: 'dirt', name: 'Dirt', color: '#a47a51', count: 8 },
  { id: 'stone', name: 'Stone', color: '#a5aaa3', count: 5 },
  { id: 'wood', name: 'Wood', color: '#a87548', count: 4 },
  { id: 'leaf', name: 'Leaves', color: '#5d915b', count: 5 },
  { id: 'sand', name: 'Sand', color: '#dbc58d', count: 3 },
  { id: 'flower', name: 'Wildflower', color: '#e8a9a0', count: 2 },
  { id: 'moss', name: 'Moss stone', color: '#778b68', count: 0 }
];
const colors = Object.fromEntries(blockDefs.map(b => [b.id, b.color]));
const blocks = new Map();
const key = (x, y, z) => `${x},${y},${z}`;
const put = (x, y, z, type) => blocks.set(key(x, y, z), { x, y, z, type });
const get = (x, y, z) => blocks.get(key(x, y, z));

function terrainHeight(x, z) {
  const wave = Math.sin(x * 0.33 + Math.sin(z * 0.24)) * 1.35 + Math.cos(z * 0.29 - x * 0.17) * 1.05;
  const hill = Math.max(0, 3.0 - Math.hypot(x + 4, z - 2) * 0.34);
  const hill2 = Math.max(0, 1.8 - Math.hypot(x - 6, z + 5) * 0.28);
  return Math.max(1, Math.min(7, Math.floor(2.4 + wave + hill + hill2)));
}
function insideIsland(x, z) { return Math.hypot(x, z) < 15.6 + Math.sin(x * .75) * .6 + Math.cos(z * .65) * .7; }
for (let x = -18; x <= 18; x++) for (let z = -18; z <= 18; z++) {
  if (!insideIsland(x, z)) continue;
  const top = terrainHeight(x, z);
  for (let y = 0; y <= top; y++) {
    const nearRim = Math.hypot(x, z) > 13.4;
    put(x, y, z, y === top ? (nearRim && top <= 2 ? 'sand' : 'grass') : y < top - 2 ? (y === 0 ? 'stone' : 'dirt') : 'dirt');
  }
}
// Rounded voxel trees, placed on the meadow's higher ridges.
const treeSpots = [[-9,-6],[-7,7],[-2,-10],[3,8],[8,1],[10,-7],[-12,2],[5,-11]];
for (const [tx,tz] of treeSpots) {
  if (!insideIsland(tx,tz)) continue;
  const ground = terrainHeight(tx,tz);
  const tall = ((tx * 7 - tz * 3) & 1) ? 4 : 3;
  for (let i=1;i<=tall;i++) put(tx, ground+i, tz, 'wood');
  const crownY = ground + tall;
  for (let dy=-1;dy<=2;dy++) for (let dx=-2;dx<=2;dx++) for (let dz=-2;dz<=2;dz++) {
    const d = Math.abs(dx)+Math.abs(dz)+Math.max(0,dy-1);
    if (d < 4 && !(dx===0&&dz===0&&dy<1) && !get(tx+dx,crownY+dy,tz+dz)) put(tx+dx,crownY+dy,tz+dz,'leaf');
  }
}
// Small flower patches and warm, mossy boulders give the meadow a lived-in feel.
for (let x=-13;x<=13;x++) for (let z=-13;z<=13;z++) {
  if (!insideIsland(x,z) || get(x,terrainHeight(x,z)+1,z)) continue;
  const n = Math.sin(x*12.2+z*4.8)*Math.cos(z*8.1-x*2.7);
  if (n > .966 && Math.hypot(x,z)>4) put(x,terrainHeight(x,z)+1,z,'flower');
  if (n < -.991 && Math.hypot(x,z)>7) put(x,terrainHeight(x,z)+1,z,'moss');
}

const cube = new THREE.BoxGeometry(1,1,1);
const mat = {};
for (const d of blockDefs) {
  if (d.id === 'grass') {
    mat.grass = [new THREE.MeshStandardMaterial({color:'#a47a51',roughness:1}),new THREE.MeshStandardMaterial({color:'#a47a51',roughness:1}),new THREE.MeshStandardMaterial({color:'#88bd70',roughness:1}),new THREE.MeshStandardMaterial({color:'#91704f',roughness:1}),new THREE.MeshStandardMaterial({color:'#a47a51',roughness:1}),new THREE.MeshStandardMaterial({color:'#a47a51',roughness:1})];
  } else mat[d.id] = new THREE.MeshStandardMaterial({ color: d.color, roughness: 1 });
}
const worldGroup = new THREE.Group(); scene.add(worldGroup);
let blockMeshes = [];
function rebuildWorld() {
  for (const mesh of blockMeshes) { worldGroup.remove(mesh); mesh.dispose?.(); }
  blockMeshes = [];
  for (const d of blockDefs) {
    const list = [...blocks.values()].filter(b => b.type === d.id);
    if (!list.length) continue;
    const mesh = new THREE.InstancedMesh(cube, mat[d.id], list.length);
    mesh.userData.blocks = list;
    mesh.castShadow = d.id !== 'flower'; mesh.receiveShadow = true;
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    list.forEach((b,i) => {
      dummy.position.set(b.x,b.y,b.z); dummy.updateMatrix(); mesh.setMatrixAt(i,dummy.matrix);
      const variation = 0.93 + (((b.x*31+b.y*17+b.z*23)%11+11)%11)*0.012;
      tint.setScalar(variation); mesh.setColorAt(i,tint);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    worldGroup.add(mesh); blockMeshes.push(mesh);
  }
}
rebuildWorld();

const waterGeo = new THREE.CircleGeometry(29, 48);
const waterMat = new THREE.MeshStandardMaterial({color:'#6db9b6',roughness:.34,metalness:.04,transparent:true,opacity:.9});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI/2; water.position.y = .12; water.receiveShadow = true; scene.add(water);
const water2 = new THREE.Mesh(new THREE.CircleGeometry(32,48), new THREE.MeshBasicMaterial({color:'#78c3bf'}));
water2.rotation.x=-Math.PI/2; water2.position.y=-.32; scene.add(water2);

const selection = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.015,1.015,1.015)), new THREE.LineBasicMaterial({color:'#fff1ad',transparent:true,opacity:.95}));
selection.visible = false; scene.add(selection);
const raycaster = new THREE.Raycaster(); raycaster.far = 6.2;
const screenCenter = new THREE.Vector2(0,0);
let target = null;

const inventory = Object.fromEntries(blockDefs.map(b=>[b.id,b.count]));
let selected = 0;
const hotbar = document.querySelector('#hotbar');
const packCount = document.querySelector('#packCount');
function drawHotbar() {
  hotbar.innerHTML = '';
  blockDefs.slice(0,7).forEach((d,i)=>{
    const slot=document.createElement('button'); slot.className=`slot${selected===i?' selected':''}`; slot.setAttribute('aria-label',`${d.name}: ${inventory[d.id]}`);
    slot.innerHTML=`<span class="block-icon ${d.id}"></span><span class="slot-count">${inventory[d.id]}</span>`;
    slot.addEventListener('pointerdown',e=>{e.preventDefault();selected=i;drawHotbar();}); hotbar.appendChild(slot);
  });
  const total=Object.values(inventory).reduce((a,b)=>a+b,0); packCount.textContent=`${total} / 99`;
}
drawHotbar();

const player = {x:0,z:0,y:terrainHeight(0,0)+.501,vy:0,grounded:true,yaw:3.14,pitch:-.32};
let started=false, paused=false, lastTime=performance.now(), toastTimer=0, mineCooldown=0, moveX=0,moveY=0;
const keys = {};
const toast = document.querySelector('#toast');
function showToast(text) { toast.textContent=text; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),1500); }
function setView() {
  camera.position.set(player.x,player.y+1.55,player.z);
  camera.rotation.order='YXZ'; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch;
}
function groundAt(x,z) {
  const ix=Math.round(x), iz=Math.round(z); let highest=-Infinity;
  for(let dx=-1;dx<=1;dx++) for(let dz=-1;dz<=1;dz++) {
    const b=get(ix+dx,0,iz+dz);
    if(Math.abs(x-(ix+dx))<.77 && Math.abs(z-(iz+dz))<.77) {
      for(let y=10;y>=0;y--) if(get(ix+dx,y,iz+dz)) { highest=Math.max(highest,y+.501); break; }
    }
  }
  return highest;
}
function updateTarget() {
  raycaster.setFromCamera(screenCenter,camera);
  const hits=raycaster.intersectObjects(blockMeshes,false);
  target=null;
  if(hits.length) {
    const hit=hits[0], b=hit.object.userData.blocks[hit.instanceId];
    if(b) target={b,normal:hit.face.normal.clone(),point:hit.point};
  }
  selection.visible=!!target;
  if(target) {
    selection.position.set(target.b.x,target.b.y,target.b.z);
    document.querySelector('#targetLabel').textContent=target.b.type.replace('-',' ').toUpperCase()+' BLOCK';
  }
}
function mineBlock() {
  if(!started||paused||!target) return;
  const b=target.b; blocks.delete(key(b.x,b.y,b.z));
  if(inventory[b.type]!==undefined) inventory[b.type]++;
  rebuildWorld(); drawHotbar(); target=null; selection.visible=false;
  showToast(`+1 ${b.type.replace('-',' ')} block`);
}
function placeBlock() {
  if(!started||paused||!target) return;
  const d=blockDefs[selected]; if(inventory[d.id]<1){showToast('No blocks left in this slot');return;}
  const n=target.normal, x=Math.round(target.b.x+n.x), y=Math.round(target.b.y+n.y), z=Math.round(target.b.z+n.z);
  if(y<0||y>12||Math.abs(x)>19||Math.abs(z)>19) return;
  if(get(x,y,z)){showToast('That spot is already taken');return;}
  if(Math.abs(x-player.x)<.8&&Math.abs(z-player.z)<.8&&y>=player.y-.3&&y<=player.y+1.7){showToast('Make a little room first');return;}
  put(x,y,z,d.id);inventory[d.id]--;rebuildWorld();drawHotbar();showToast(`${d.name} placed`);
}
function jump(){if(started&&!paused&&player.grounded){player.vy=7.1;player.grounded=false;}}
function isTouchDevice(){return matchMedia('(pointer:coarse)').matches||innerWidth<=700;}
function beginGame(){started=true;document.querySelector('#intro').classList.add('hidden');lastTime=performance.now();if(!isTouchDevice())canvas.requestPointerLock?.();}
document.querySelector('#playBtn').addEventListener('click',beginGame);
document.querySelector('#resumeBtn').addEventListener('click',()=>{paused=false;document.querySelector('#pauseScreen').classList.add('hidden');lastTime=performance.now();});
document.querySelector('#mineBtn').addEventListener('pointerdown',e=>{e.preventDefault();mineBlock();});
document.querySelector('#placeBtn').addEventListener('pointerdown',e=>{e.preventDefault();placeBlock();});
document.querySelector('#jumpBtn').addEventListener('pointerdown',e=>{e.preventDefault();jump();});
document.querySelector('#soundBtn').addEventListener('click',e=>{e.currentTarget.classList.toggle('muted');showToast(e.currentTarget.classList.contains('muted')?'Sound off':'Sound on');});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(!started||paused)return;if(e.pointerType==='mouse'){if(e.button===0)mineBlock();if(e.button===2)placeBlock();}});
let lookPointer=null, lastLookX=0,lastLookY=0;
canvas.addEventListener('pointerdown',e=>{
  if(!started||paused||e.pointerType==='mouse')return;
  lookPointer=e.pointerId;lastLookX=e.clientX;lastLookY=e.clientY;
  try{canvas.setPointerCapture(e.pointerId)}catch{}
});
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse'&&document.pointerLockElement===canvas){player.yaw-=e.movementX*.0022;player.pitch=Math.max(-1.25,Math.min(1.25,player.pitch-e.movementY*.0022));}
  else if(e.pointerId===lookPointer){const dx=e.clientX-lastLookX,dy=e.clientY-lastLookY;lastLookX=e.clientX;lastLookY=e.clientY;player.yaw-=dx*.006;player.pitch=Math.max(-1.2,Math.min(1.2,player.pitch-dy*.006));}
});
canvas.addEventListener('pointerup',e=>{if(e.pointerId===lookPointer)lookPointer=null;});
canvas.addEventListener('pointercancel',e=>{if(e.pointerId===lookPointer)lookPointer=null;});

document.addEventListener('pointerlockchange',()=>{
  if(started&&document.pointerLockElement!==canvas&&!isTouchDevice()&&!paused){paused=true;document.querySelector('#pauseScreen').classList.remove('hidden');}
});
document.addEventListener('keydown',e=>{
  keys[e.code]=true;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='Space')jump();
  if(/^Digit[1-7]$/.test(e.code)){selected=Number(e.code.slice(-1))-1;drawHotbar();}
  if(e.code==='Escape'&&started&&!paused&&isTouchDevice()){paused=true;document.querySelector('#pauseScreen').classList.remove('hidden');}
});
document.addEventListener('keyup',e=>{keys[e.code]=false;});

// A tactile thumbstick with a soft circular dead zone.
const movePad=document.querySelector('#movePad'), padStick=document.querySelector('#padStick');
let padPointer=null;
function setPad(e){const rect=movePad.getBoundingClientRect(),cx=rect.left+45,cy=rect.top+50,dx=e.clientX-cx,dy=e.clientY-cy,lim=28,len=Math.hypot(dx,dy),scale=len>lim?lim/len:1;moveX=dx*scale/lim;moveY=dy*scale/lim;padStick.style.transform=`translate(calc(-50% + ${dx*scale}px),calc(-50% + ${dy*scale}px))`;}
movePad.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();padPointer=e.pointerId;movePad.setPointerCapture(e.pointerId);setPad(e);});
movePad.addEventListener('pointermove',e=>{if(e.pointerId===padPointer)setPad(e);});
function releasePad(e){if(e.pointerId!==padPointer)return;padPointer=null;moveX=moveY=0;padStick.style.transform='translate(-50%,-50%)';}
movePad.addEventListener('pointerup',releasePad);movePad.addEventListener('pointercancel',releasePad);

function animate(now){
  requestAnimationFrame(animate);
  const dt=Math.min(.04,(now-lastTime)/1000);lastTime=now;
  if(started&&!paused){
    let forward=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-moveY;
    let sideways=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+moveX;
    const mag=Math.hypot(forward,sideways);if(mag>1){forward/=mag;sideways/=mag;}
    const speed=4.4, dx=(Math.sin(player.yaw)*forward+Math.cos(player.yaw)*sideways)*speed*dt, dz=(-Math.cos(player.yaw)*forward+Math.sin(player.yaw)*sideways)*speed*dt;
    const nx=player.x+dx,nz=player.z+dz, floor=groundAt(nx,nz);
    if(floor!==-Infinity&&(floor-player.y<.85||player.vy>0)){player.x=nx;player.z=nz;}
    player.vy-=18*dt;player.y+=player.vy*dt;
    const here=groundAt(player.x,player.z);
    if(here!==-Infinity&&player.y<=here){player.y=here;player.vy=0;player.grounded=true;}else player.grounded=false;
    if(player.y< -4){player.x=0;player.z=0;player.y=terrainHeight(0,0)+.501;player.vy=0;showToast('Back to the meadow');}
  }
  setView();
  if(started&&!paused){updateTarget();document.querySelector('#hintPill').classList.add('show');}
  water.position.y=.12+Math.sin(now*.00045)*.045;
  sun.position.x=-12+Math.sin(now*.00008)*4;
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.setSize(innerWidth,innerHeight);});
