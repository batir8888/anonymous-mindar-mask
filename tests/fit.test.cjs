const {test} = require('node:test');
const assert = require('node:assert/strict');
require('../mask-fit.js');
function estimate() {
 const metricLandmarks = Array.from({length:468}, () => [0,0,0]);
 for (const [i,p] of Object.entries({168:[0,3.271027,5.236015],4:[0,-.46317,7.58658],33:[-4.445859,2.663991,3.173422],133:[-1.856432,2.585245,3.757904],263:[4.445859,2.663991,3.173422],362:[1.856432,2.585245,3.757904],152:[0,-9.403378,4.264492]})) metricLandmarks[i] = p;
 return {metricLandmarks,faceScale:15.48619};
}
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
test('eye openings align with face landmarks and sit only 0.018 face widths in front', () => {
 const e=estimate(), f=fitMask(e), p=e.metricLandmarks;
 const eye=p[263].map((v,k)=>(v+p[362][k])/2);
 const target=eye.map((v,k)=>(v-p[168][k])/e.faceScale);
 near(f.position[0]+.43*f.scale[0],target[0]);
 near(f.position[1]+.39*f.scale[1],target[1]);
 near(f.position[2]+.306001*f.scale[2],target[2]+.018);
 near(f.position[2]+.910237*f.scale[2],(p[4][2]-p[168][2])/e.faceScale+.018);
 near(f.position[1]-1.30*f.scale[1],(p[152][1]-p[168][1])/e.faceScale);
 // Regression: old fixed offset put the eye plane much further in front.
 assert.ok((-.12+.53*.306001)-target[2]>.15);
});
test('fit is invariant to metric units and face-space translation', () => {
 const e=estimate(),f=fitMask(e);
 const scaled={faceScale:e.faceScale*3,metricLandmarks:e.metricLandmarks.map(p=>p.map(v=>v*3+42))};
 const result=fitMask(scaled);
 for (const k of ['scale','position']) f[k].forEach((v,i)=>near(v,result[k][i]));
});
test('invalid tracking samples do not produce transforms', () => {
 assert.equal(fitMask(null),null);
 assert.equal(fitMask({...estimate(),faceScale:0}),null);
 const e=estimate();e.metricLandmarks[4][0]=NaN;assert.equal(fitMask(e),null);
});
