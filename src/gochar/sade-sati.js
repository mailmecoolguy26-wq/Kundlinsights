'use strict';
function calculateSadeSati(houseFromNatalMoon){const phase={12:'rising',1:'peak',2:'setting'}[houseFromNatalMoon]||'none';return {detected:phase!=='none',phase,houseFromNatalMoon};}
module.exports={calculateSadeSati};
