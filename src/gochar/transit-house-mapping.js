'use strict';
function natalHouseForTransitRashi(houseByRashi,rashiIndex){const house=houseByRashi[rashiIndex];if(!house)throw new RangeError('Natal house mapping cannot resolve transit Rashi.');return house;}
module.exports={natalHouseForTransitRashi};
