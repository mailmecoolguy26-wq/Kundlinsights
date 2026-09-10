'use strict';

const HINGLISH_PLANETS = Object.freeze({ Saturn: 'Shani Dev', Jupiter: 'Guru Dev', Mars: 'Mangal', Mercury: 'Budh', Venus: 'Shukra', Sun: 'Surya Dev', Moon: 'Chandra Dev', Rahu: 'Rahu', Ketu: 'Ketu' });
const planet = (name) => HINGLISH_PLANETS[name] || name;
function paired(english, hinglish) { return Object.freeze({ english, hinglish }); }
function careerRelevance(planetName) {
  return paired(`${planetName}'s current transit contributes to your Career timing analysis.`, `${planet(planetName)} ka current Gochar aapki Career timing analysis ka hissa hai.`);
}
function retrograde(planetName) { return paired(`${planetName} is currently retrograde.`, `${planet(planetName)} abhi Vakri hain.`); }
function sadeSati(phase) { return paired(`Sade Sati is currently active (${phase}).`, `Sade Sati abhi active hai (${phase}).`); }
module.exports = { careerRelevance, retrograde, sadeSati };
