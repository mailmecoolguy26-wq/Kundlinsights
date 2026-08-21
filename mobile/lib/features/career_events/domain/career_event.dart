enum CareerEventType {
  firstJob('FIRST_JOB'),
  jobSwitch('JOB_SWITCH'),
  promotion('PROMOTION'),
  roleChange('ROLE_CHANGE'),
  salaryGrowth('SALARY_GROWTH'),
  jobLoss('JOB_LOSS'),
  businessStarted('BUSINESS_STARTED'),
  careerBreakthrough('CAREER_BREAKTHROUGH'),
  careerSetback('CAREER_SETBACK'),
  other('OTHER');

  const CareerEventType(this.wireValue);
  final String wireValue;

  static CareerEventType fromWireValue(String value) =>
      CareerEventType.values.firstWhere((item) => item.wireValue == value);
}

enum CareerEventDatePrecision {
  day('DAY'),
  month('MONTH'),
  year('YEAR');

  const CareerEventDatePrecision(this.wireValue);
  final String wireValue;

  static CareerEventDatePrecision fromWireValue(String value) =>
      CareerEventDatePrecision.values.firstWhere(
        (item) => item.wireValue == value,
      );
}

class CareerEventDate {
  const CareerEventDate({
    required this.precision,
    required this.year,
    this.month,
    this.day,
  }) : assert(
         (precision == CareerEventDatePrecision.day &&
                 month != null &&
                 day != null) ||
             (precision == CareerEventDatePrecision.month &&
                 month != null &&
                 day == null) ||
             (precision == CareerEventDatePrecision.year &&
                 month == null &&
                 day == null),
       );

  final CareerEventDatePrecision precision;
  final int year;
  final int? month;
  final int? day;

  Map<String, Object> toJson() {
    final value = <String, Object>{
      'precision': precision.wireValue,
      'year': year,
    };
    if (month != null) value['month'] = month!;
    if (day != null) value['day'] = day!;
    return value;
  }

  factory CareerEventDate.fromJson(Map<String, dynamic> json) =>
      CareerEventDate(
        precision: CareerEventDatePrecision.fromWireValue(
          json['precision'] as String,
        ),
        year: json['year'] as int,
        month: json['month'] as int?,
        day: json['day'] as int?,
      );
}

class CareerEvent {
  const CareerEvent({
    required this.careerEventId,
    required this.birthProfileId,
    required this.eventType,
    required this.eventDate,
    required this.title,
    required this.notes,
    required this.createdAt,
    required this.updatedAt,
  });

  final String careerEventId;
  final String birthProfileId;
  final CareerEventType eventType;
  final CareerEventDate eventDate;
  final String? title;
  final String? notes;
  final String createdAt;
  final String updatedAt;

  factory CareerEvent.fromJson(Map<String, dynamic> json) => CareerEvent(
    careerEventId: json['careerEventId'] as String,
    birthProfileId: json['birthProfileId'] as String,
    eventType: CareerEventType.fromWireValue(json['eventType'] as String),
    eventDate: CareerEventDate.fromJson(
      Map<String, dynamic>.from(json['eventDate'] as Map),
    ),
    title: json['title'] as String?,
    notes: json['notes'] as String?,
    createdAt: json['createdAt'] as String,
    updatedAt: json['updatedAt'] as String,
  );
}

class CareerEventInput {
  const CareerEventInput({
    required this.eventType,
    required this.eventDate,
    this.title,
    this.notes,
  });

  final CareerEventType eventType;
  final CareerEventDate eventDate;
  final String? title;
  final String? notes;

  Map<String, Object?> toJson() => {
    'eventType': eventType.wireValue,
    'eventDate': eventDate.toJson(),
    'title': title?.trim().isEmpty == true ? null : title?.trim(),
    'notes': notes?.trim().isEmpty == true ? null : notes?.trim(),
  };
}
