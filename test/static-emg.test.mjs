import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCh1,EmgLines,EmgSamples} from '../public/assets/emg.mjs';
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
