import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCh1,EmgLines,EmgSamples,signalColor,signalSegments,demoSample} from '../public/assets/emg.mjs';
test('CH1 parser supports legacy formats without treating diagnostic numbers as samples',()=>{
 for(const [line,want] of [['CH1:1200',1200],['channel 1=-12.5',-12.5],['1,2,3',1],['-3',-3],['CH2:50 CH1:125',125],['CH1:1e3',1000],['error 404',null],['CH2:1200',null],['CH1:123abc',null],['NaN',null],['1e999',null]])assert.equal(parseCh1(line),want,line);
});
test('serial framing buffers split numbers and CRLF without duplicate or partial samples',()=>{
 const lines=new EmgLines();assert.deepEqual(lines.feed('CH1:12'),[]);
 assert.deepEqual(lines.feed('34\r').map(x=>x.value),[1234]);
 assert.deepEqual(lines.feed('\nCH1:20\n30,40\r\n').map(x=>x.value),[20,30]);
 assert.deepEqual(lines.feed('CH1:5'),[]);
});
test('oversized lines are discarded and framing recovers at the next delimiter',()=>{
 const lines=new EmgLines();lines.feed('8'.repeat(5000));assert.equal(lines.buffer.length,0);
 assert.deepEqual(lines.feed('\nCH1:7\n').map(x=>x.value),[null,7]);
});
test('display smoothing preserves raw values and limits retained samples',()=>{
 const data=new EmgSamples();data.add(0,0);data.add(1000,1);assert.equal(data.points[1].raw,1000);assert.equal(data.points[1].filtered,52.8);
 for(let i=0;i<1000;i++)data.add(i,i);assert.equal(data.points.length,512);assert.equal(data.count,1002);
 data.clear();assert.equal(data.points.length,0);assert.equal(data.filtered,null);
});

test('signal colors split ascending and descending lines at exact thresholds',()=>{
 assert.equal(signalColor(0),'#23834b');assert.equal(signalColor(99),'#23834b');
 assert.equal(signalColor(100),'#b58200');assert.equal(signalColor(1000),'#b58200');
 assert.equal(signalColor(1001),'#d3423f');assert.equal(signalColor(-1),'#738078');
 const ascending=signalSegments(0,2000);
 assert.deepEqual(ascending.map(s=>s.color),['#23834b','#b58200','#d3423f']);
 assert.deepEqual(ascending.map(s=>s.to),[.05,.5,1]);
 assert.deepEqual(signalSegments(2000,0).map(s=>s.color),['#d3423f','#b58200','#23834b']);
 assert.equal(signalSegments(100,100)[0].color,'#b58200');
});

test('demo spends visible time in each color range and stays nonnegative',()=>{
 for(const random of [()=>0,()=>.5,()=>1]){
  const values=Array.from({length:250},(_,i)=>demoSample(i,random));
  for(const color of ['#23834b','#b58200','#d3423f'])assert.ok(values.filter(v=>signalColor(v)===color).length>=25,color);
  assert.ok(values.every(v=>Number.isFinite(v)&&v>=0));
 }
 assert.notEqual(demoSample(125,()=>0),demoSample(125,()=>1));
});
