import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[Locale('en')];

  /// No description provided for @appTitle.
  ///
  /// In en, this message translates to:
  /// **'KundlInsights'**
  String get appTitle;

  /// No description provided for @home.
  ///
  /// In en, this message translates to:
  /// **'Home'**
  String get home;

  /// No description provided for @kundli.
  ///
  /// In en, this message translates to:
  /// **'Kundli'**
  String get kundli;

  /// No description provided for @insights.
  ///
  /// In en, this message translates to:
  /// **'Insights'**
  String get insights;

  /// No description provided for @readings.
  ///
  /// In en, this message translates to:
  /// **'Readings'**
  String get readings;

  /// No description provided for @profile.
  ///
  /// In en, this message translates to:
  /// **'Profile'**
  String get profile;

  /// No description provided for @welcome.
  ///
  /// In en, this message translates to:
  /// **'Welcome to KundlInsights'**
  String get welcome;

  /// No description provided for @activeProfile.
  ///
  /// In en, this message translates to:
  /// **'Your active profile'**
  String get activeProfile;

  /// No description provided for @profileBody.
  ///
  /// In en, this message translates to:
  /// **'Connect a birth profile to personalize this space.'**
  String get profileBody;

  /// No description provided for @currentInsights.
  ///
  /// In en, this message translates to:
  /// **'Your current insights will appear here'**
  String get currentInsights;

  /// No description provided for @currentInsightsBody.
  ///
  /// In en, this message translates to:
  /// **'KundlInsights will present backend-authoritative astrology once your profile is connected.'**
  String get currentInsightsBody;

  /// No description provided for @comingSoon.
  ///
  /// In en, this message translates to:
  /// **'Coming soon'**
  String get comingSoon;

  /// No description provided for @explore.
  ///
  /// In en, this message translates to:
  /// **'Explore'**
  String get explore;

  /// No description provided for @career.
  ///
  /// In en, this message translates to:
  /// **'Career'**
  String get career;

  /// No description provided for @marriage.
  ///
  /// In en, this message translates to:
  /// **'Marriage'**
  String get marriage;

  /// No description provided for @wealth.
  ///
  /// In en, this message translates to:
  /// **'Wealth & Property'**
  String get wealth;

  /// No description provided for @myKundli.
  ///
  /// In en, this message translates to:
  /// **'My Kundli'**
  String get myKundli;

  /// No description provided for @kundliBody.
  ///
  /// In en, this message translates to:
  /// **'Your North Indian Kundli chart will appear here once your birth profile is connected.'**
  String get kundliBody;

  /// No description provided for @chartSemantics.
  ///
  /// In en, this message translates to:
  /// **'Reserved North Indian Kundli chart area. No astrology data is shown yet.'**
  String get chartSemantics;

  /// No description provided for @detailedReadings.
  ///
  /// In en, this message translates to:
  /// **'Detailed Readings'**
  String get detailedReadings;

  /// No description provided for @readingsBody.
  ///
  /// In en, this message translates to:
  /// **'Your personalized readings will appear here.'**
  String get readingsBody;

  /// No description provided for @settings.
  ///
  /// In en, this message translates to:
  /// **'Settings'**
  String get settings;

  /// No description provided for @birthProfiles.
  ///
  /// In en, this message translates to:
  /// **'Birth Profiles'**
  String get birthProfiles;

  /// No description provided for @language.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get language;

  /// No description provided for @privacy.
  ///
  /// In en, this message translates to:
  /// **'Privacy'**
  String get privacy;

  /// No description provided for @terms.
  ///
  /// In en, this message translates to:
  /// **'Terms'**
  String get terms;

  /// No description provided for @unavailable.
  ///
  /// In en, this message translates to:
  /// **'Available after account setup'**
  String get unavailable;

  /// No description provided for @insightsBody.
  ///
  /// In en, this message translates to:
  /// **'Explore the areas KundlInsights will support as secure backend integrations become available.'**
  String get insightsBody;

  /// No description provided for @signInTitle.
  ///
  /// In en, this message translates to:
  /// **'Welcome back'**
  String get signInTitle;

  /// No description provided for @signUpTitle.
  ///
  /// In en, this message translates to:
  /// **'Create your account'**
  String get signUpTitle;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @signUp.
  ///
  /// In en, this message translates to:
  /// **'Sign up'**
  String get signUp;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get confirmPassword;

  /// No description provided for @createAccount.
  ///
  /// In en, this message translates to:
  /// **'Create an account'**
  String get createAccount;

  /// No description provided for @alreadyHaveAccount.
  ///
  /// In en, this message translates to:
  /// **'Already have an account? Sign in'**
  String get alreadyHaveAccount;

  /// No description provided for @passwordRequirements.
  ///
  /// In en, this message translates to:
  /// **'Use a valid email and matching passwords with at least 8 characters.'**
  String get passwordRequirements;

  /// No description provided for @authRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'Unable to complete that request. Please try again.'**
  String get authRequestFailed;

  /// No description provided for @createBirthProfile.
  ///
  /// In en, this message translates to:
  /// **'Create birth profile'**
  String get createBirthProfile;

  /// No description provided for @addProfile.
  ///
  /// In en, this message translates to:
  /// **'Add profile'**
  String get addProfile;

  /// No description provided for @profileLabel.
  ///
  /// In en, this message translates to:
  /// **'Profile label'**
  String get profileLabel;

  /// No description provided for @profileLabelHint.
  ///
  /// In en, this message translates to:
  /// **'For example, My Profile'**
  String get profileLabelHint;

  /// No description provided for @defaultProfileLabel.
  ///
  /// In en, this message translates to:
  /// **'Birth profile'**
  String get defaultProfileLabel;

  /// No description provided for @dateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get dateOfBirth;

  /// No description provided for @birthTime.
  ///
  /// In en, this message translates to:
  /// **'Birth time'**
  String get birthTime;

  /// No description provided for @placeOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Place of birth'**
  String get placeOfBirth;

  /// No description provided for @selectDate.
  ///
  /// In en, this message translates to:
  /// **'Select date'**
  String get selectDate;

  /// No description provided for @selectTime.
  ///
  /// In en, this message translates to:
  /// **'Select time'**
  String get selectTime;

  /// No description provided for @birthTimeHelp.
  ///
  /// In en, this message translates to:
  /// **'Birth time is important for calculating your Ascendant and house positions.'**
  String get birthTimeHelp;

  /// No description provided for @placeSearchHint.
  ///
  /// In en, this message translates to:
  /// **'Start typing a city or place'**
  String get placeSearchHint;

  /// No description provided for @noPlaceResults.
  ///
  /// In en, this message translates to:
  /// **'No places found. Try another search.'**
  String get noPlaceResults;

  /// No description provided for @googleMapsAttribution.
  ///
  /// In en, this message translates to:
  /// **'Google Maps'**
  String get googleMapsAttribution;

  /// No description provided for @reviewProfile.
  ///
  /// In en, this message translates to:
  /// **'Review profile'**
  String get reviewProfile;

  /// No description provided for @edit.
  ///
  /// In en, this message translates to:
  /// **'Edit'**
  String get edit;

  /// No description provided for @createProfile.
  ///
  /// In en, this message translates to:
  /// **'Create Profile'**
  String get createProfile;

  /// No description provided for @continueLabel.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get continueLabel;

  /// No description provided for @step.
  ///
  /// In en, this message translates to:
  /// **'Step'**
  String get step;

  /// No description provided for @stepOf.
  ///
  /// In en, this message translates to:
  /// **'of'**
  String get stepOf;

  /// No description provided for @completeRequiredFields.
  ///
  /// In en, this message translates to:
  /// **'Complete this field to continue.'**
  String get completeRequiredFields;

  /// No description provided for @profileRequestFailed.
  ///
  /// In en, this message translates to:
  /// **'We could not complete that request. Please try again.'**
  String get profileRequestFailed;

  /// No description provided for @ambiguousBirthTime.
  ///
  /// In en, this message translates to:
  /// **'This local time occurs twice due to a clock change. Please confirm a different time.'**
  String get ambiguousBirthTime;

  /// No description provided for @nonexistentBirthTime.
  ///
  /// In en, this message translates to:
  /// **'This local time did not occur due to a clock change. Please choose another time.'**
  String get nonexistentBirthTime;

  /// No description provided for @active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// No description provided for @activeProfileIndicator.
  ///
  /// In en, this message translates to:
  /// **'Active birth profile'**
  String get activeProfileIndicator;

  /// No description provided for @retry.
  ///
  /// In en, this message translates to:
  /// **'Retry'**
  String get retry;

  /// No description provided for @profileUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This profile is unavailable.'**
  String get profileUnavailable;

  /// No description provided for @editDeleteUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Profile editing and deletion are not available yet.'**
  String get editDeleteUnavailable;

  /// No description provided for @natalSummary.
  ///
  /// In en, this message translates to:
  /// **'Natal Summary'**
  String get natalSummary;

  /// No description provided for @ascendant.
  ///
  /// In en, this message translates to:
  /// **'Ascendant'**
  String get ascendant;

  /// No description provided for @moonSign.
  ///
  /// In en, this message translates to:
  /// **'Moon Sign'**
  String get moonSign;

  /// No description provided for @sunSign.
  ///
  /// In en, this message translates to:
  /// **'Sun Sign'**
  String get sunSign;

  /// No description provided for @sign.
  ///
  /// In en, this message translates to:
  /// **'Sign'**
  String get sign;

  /// No description provided for @nakshatra.
  ///
  /// In en, this message translates to:
  /// **'Nakshatra'**
  String get nakshatra;

  /// No description provided for @pada.
  ///
  /// In en, this message translates to:
  /// **'Pada'**
  String get pada;

  /// No description provided for @planetaryPositions.
  ///
  /// In en, this message translates to:
  /// **'Planetary Positions'**
  String get planetaryPositions;

  /// No description provided for @northIndianChart.
  ///
  /// In en, this message translates to:
  /// **'North Indian Chart'**
  String get northIndianChart;

  /// No description provided for @northIndianChartPlaceholder.
  ///
  /// In en, this message translates to:
  /// **'North Indian chart visualization will appear here.'**
  String get northIndianChartPlaceholder;

  /// No description provided for @northIndianChartSemantics.
  ///
  /// In en, this message translates to:
  /// **'North Indian chart visualization placeholder. No chart geometry is shown yet.'**
  String get northIndianChartSemantics;

  /// No description provided for @house.
  ///
  /// In en, this message translates to:
  /// **'House'**
  String get house;

  /// No description provided for @degreeInSign.
  ///
  /// In en, this message translates to:
  /// **'Degree in Sign'**
  String get degreeInSign;

  /// No description provided for @longitude.
  ///
  /// In en, this message translates to:
  /// **'Longitude'**
  String get longitude;

  /// No description provided for @speed.
  ///
  /// In en, this message translates to:
  /// **'Speed'**
  String get speed;

  /// No description provided for @motion.
  ///
  /// In en, this message translates to:
  /// **'Motion'**
  String get motion;

  /// No description provided for @retrograde.
  ///
  /// In en, this message translates to:
  /// **'Retrograde'**
  String get retrograde;

  /// No description provided for @astronomicalDetails.
  ///
  /// In en, this message translates to:
  /// **'Astronomical Details'**
  String get astronomicalDetails;

  /// No description provided for @natalSummaryUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your natal summary is unavailable right now. Please try again.'**
  String get natalSummaryUnavailable;

  /// No description provided for @natalSummaryLoading.
  ///
  /// In en, this message translates to:
  /// **'Natal summary loading'**
  String get natalSummaryLoading;

  /// No description provided for @speedDegreesPerDay.
  ///
  /// In en, this message translates to:
  /// **'{value}°/day'**
  String speedDegreesPerDay(Object value);

  /// No description provided for @refresh.
  ///
  /// In en, this message translates to:
  /// **'Refresh'**
  String get refresh;

  /// No description provided for @planetDetail.
  ///
  /// In en, this message translates to:
  /// **'Planet Detail'**
  String get planetDetail;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
