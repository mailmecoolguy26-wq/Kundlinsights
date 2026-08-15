Map<String, dynamic> ashtakavargaFixture({String profileId = 'profile-a'}) {
  List<Map<String, dynamic>> scores(int seed) => List.generate(
    12,
    (index) => {
      'sign': {'rashiIndex': index + 1, 'sanskritName': 'Rashi-${index + 1}'},
      'score': seed + index,
    },
  );
  return {
    'birthProfileId': profileId,
    'sav': {'rulesetId': 'raw-sav-v1', 'signScores': scores(17)},
    'bav': ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']
        .map(
          (body) => {
            'body': body,
            'rulesetId': 'raw-bav-v1',
            'signScores': scores(1),
          },
        )
        .toList(),
    'lagnaBav': {'rulesetId': 'raw-lagna-bav-v1', 'signScores': scores(2)},
  };
}
