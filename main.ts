import{mkdirSync as mk,readFileSync as rf,readdirSync as rd,writeFileSync as wf}from'node:fs';
import{join as J}from'node:path';
const IM=new Int8Array(256).fill(-1),PO=new Int8Array(256),PU=new Int8Array(256);
for(const[a,b,c,d]of[[0,0,0,0],[1,1,0,1],[2,4,0,1],[3,0,1,0],[4,0,1,2],[5,0,2,2],[6,0,2,3],[7,0,3,3],[16,0,2,1],[17,0,2,1],[18,0,2,1],[19,0,2,1],[20,0,2,1],[21,0,2,1],[22,0,2,1],[23,0,1,1],[24,0,2,1],[25,0,2,1],[26,0,2,1],[27,0,1,1],[28,0,2,1],[29,0,2,1],[30,0,2,1],[32,0,2,1],[33,0,2,1],[34,0,2,1],[48,2,0,0],[49,2,1,0],[50,2,1,0],[51,2,0,0],[52,0,0,0],[64,0,1,1],[65,0,2,0],[80,0,1,0],[81,0,1,0],[82,0,0,1],[83,0,1,0]]){IM[a]=b;PO[a]=c;PU[a]=d}
const Z=Symbol();
function B(o,a,b){switch(o){case 16:return a+b|0;case 17:return a-b|0;case 18:return Math.imul(a,b);case 19:return b?(a/b)|0:Z;case 20:return b?(a%b)|0:Z;case 21:return b?((a>>>0)/(b>>>0))|0:Z;case 22:return b?((a>>>0)%(b>>>0))|0:Z;case 24:return a&b;case 25:return a|b;case 26:return a^b;case 28:return a<<(b&31);case 29:return a>>(b&31);case 30:return a>>>(b&31);case 32:return a===b?1:0;case 33:return a<b?1:0;default:return(a>>>0)<(b>>>0)?1:0}}
function R(p,q){const n=p.length,S=new Int32Array(256),C=new Int32Array(64),M=new Int32Array(256),O=new Uint8Array(65536);let s=0,c=0,l=0,i=0,pc=0,t=0;const D=e=>({out:Buffer.from(O.subarray(0,l)),exit:e});for(;;){if(t===1e6)return D(10);if(pc<0||pc>=n)return D(9);const o=p[pc],m=IM[o];if(m<0)return D(5);if(pc+m>=n)return D(9);t++;if(s<PO[o])return D(2);if(s-PO[o]+PU[o]>256)return D(3);const x=pc+1+m;pc=x;switch(o){
case 0:return D(0);
case 1:S[s++]=p[x-1]<<24>>24;break;
case 2:S[s++]=p[x-4]|p[x-3]<<8|p[x-2]<<16|p[x-1]<<24;break;
case 3:s--;break;
case 4:S[s]=S[s-1];s++;break;
case 5:{const v=S[s-1];S[s-1]=S[s-2];S[s-2]=v;break}
case 6:S[s]=S[s-2];s++;break;
case 7:{const v=S[s-3];S[s-3]=S[s-2];S[s-2]=S[s-1];S[s-1]=v;break}
case 23:S[s-1]=-S[s-1];break;
case 27:S[s-1]=~S[s-1];break;
case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:{const r=B(o,S[s-2],S[s-1]);if(r===Z)return D(4);s--;S[s-1]=r;break}
case 48:case 49:case 50:{const r=(p[x-2]|p[x-1]<<8)<<16>>16;if(o===48||(o===49)===(S[--s]===0))pc=x+r;break}
case 51:if(c===64)return D(7);C[c++]=x;pc=p[x-2]|p[x-1]<<8;break;
case 52:if(!c)return D(8);pc=C[--c];break;
case 64:case 65:{const a=S[s-1];if(a<0||a>255)return D(6);if(o===64)S[s-1]=M[a];else{M[a]=S[s-2];s-=2}break}
case 80:{const v=String(S[s-1]);if(l+v.length>65536)return D(11);s--;for(let j=0;j<v.length;j++)O[l++]=v.charCodeAt(j);break}
case 81:if(l>65535)return D(11);O[l++]=S[--s]&255;break;
case 82:S[s++]=i<q.length?q[i++]:-1;break;
case 83:return D(S[--s]&255);
}}}
const I=process.env.MAKEFUN_INPUT_DIR??'/input',W=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of rd(I).sort()){const{out,exit}=R(rf(J(I,id,'program.bin')),rf(J(I,id,'input.bin')));mk(J(W,id),{recursive:true});wf(J(W,id,'stdout.bin'),out);wf(J(W,id,'exit.txt'),exit+'\n')}
