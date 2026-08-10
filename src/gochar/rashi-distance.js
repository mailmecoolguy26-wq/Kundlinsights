'use strict';
function houseFromRashi(from,to){return ((to-from+12)%12)+1;}
function circularSeparation(a,b){const d=Math.abs(a-b)%360;return Math.min(d,360-d);}
module.exports={houseFromRashi,circularSeparation};
