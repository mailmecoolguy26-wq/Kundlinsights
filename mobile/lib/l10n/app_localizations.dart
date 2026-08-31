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

  /// No description provided for @myReadings.
  ///
  /// In en, this message translates to:
  /// **'My Readings'**
  String get myReadings;

  /// No description provided for @careerReading.
  ///
  /// In en, this message translates to:
  /// **'Career Reading'**
  String get careerReading;

  /// No description provided for @generateCareerReading.
  ///
  /// In en, this message translates to:
  /// **'Generate Career Reading'**
  String get generateCareerReading;

  /// No description provided for @generatingCareerReading.
  ///
  /// In en, this message translates to:
  /// **'Generating your Career Reading…'**
  String get generatingCareerReading;

  /// No description provided for @checkingCareerReadingAvailability.
  ///
  /// In en, this message translates to:
  /// **'Checking Career Reading availability…'**
  String get checkingCareerReadingAvailability;

  /// No description provided for @careerReadingUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Career Reading is currently unavailable.'**
  String get careerReadingUnavailable;

  /// No description provided for @careerAvailabilityUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Career Reading availability is unavailable right now.'**
  String get careerAvailabilityUnavailable;

  /// No description provided for @createdOn.
  ///
  /// In en, this message translates to:
  /// **'Created'**
  String get createdOn;

  /// No description provided for @noReadingsYet.
  ///
  /// In en, this message translates to:
  /// **'No readings yet.'**
  String get noReadingsYet;

  /// No description provided for @noReadingsBody.
  ///
  /// In en, this message translates to:
  /// **'You’ll find your personalized readings here after they’re generated.'**
  String get noReadingsBody;

  /// No description provided for @readingsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your saved readings are unavailable right now. Please try again.'**
  String get readingsUnavailable;

  /// No description provided for @readingUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This saved reading is unavailable right now. Please return to My Readings and try again.'**
  String get readingUnavailable;

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

  /// No description provided for @currentTransits.
  ///
  /// In en, this message translates to:
  /// **'Current Transits'**
  String get currentTransits;

  /// No description provided for @gochar.
  ///
  /// In en, this message translates to:
  /// **'Gochar'**
  String get gochar;

  /// No description provided for @transitSign.
  ///
  /// In en, this message translates to:
  /// **'Transit Sign'**
  String get transitSign;

  /// No description provided for @natalHouse.
  ///
  /// In en, this message translates to:
  /// **'Natal House'**
  String get natalHouse;

  /// No description provided for @direct.
  ///
  /// In en, this message translates to:
  /// **'Direct'**
  String get direct;

  /// No description provided for @sadeSati.
  ///
  /// In en, this message translates to:
  /// **'Sade Sati'**
  String get sadeSati;

  /// No description provided for @active.
  ///
  /// In en, this message translates to:
  /// **'Active'**
  String get active;

  /// No description provided for @notActive.
  ///
  /// In en, this message translates to:
  /// **'Not Active'**
  String get notActive;

  /// No description provided for @snapshotTime.
  ///
  /// In en, this message translates to:
  /// **'Snapshot Time'**
  String get snapshotTime;

  /// No description provided for @planetaryTransits.
  ///
  /// In en, this message translates to:
  /// **'Planetary Transits'**
  String get planetaryTransits;

  /// No description provided for @phase.
  ///
  /// In en, this message translates to:
  /// **'Phase'**
  String get phase;

  /// No description provided for @status.
  ///
  /// In en, this message translates to:
  /// **'Status'**
  String get status;

  /// No description provided for @currentTransitsLoading.
  ///
  /// In en, this message translates to:
  /// **'Current transits loading'**
  String get currentTransitsLoading;

  /// No description provided for @currentTransitsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your current transits are unavailable right now. Please try again.'**
  String get currentTransitsUnavailable;

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

  /// No description provided for @signingOut.
  ///
  /// In en, this message translates to:
  /// **'Signing out…'**
  String get signingOut;

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

  /// No description provided for @enterEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter your email.'**
  String get enterEmail;

  /// No description provided for @enterValidEmail.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address.'**
  String get enterValidEmail;

  /// No description provided for @enterPassword.
  ///
  /// In en, this message translates to:
  /// **'Enter your password.'**
  String get enterPassword;

  /// No description provided for @confirmPasswordRequired.
  ///
  /// In en, this message translates to:
  /// **'Confirm your password.'**
  String get confirmPasswordRequired;

  /// No description provided for @passwordMinimumLength.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters.'**
  String get passwordMinimumLength;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'Passwords do not match.'**
  String get passwordsDoNotMatch;

  /// No description provided for @showPassword.
  ///
  /// In en, this message translates to:
  /// **'Show password'**
  String get showPassword;

  /// No description provided for @hidePassword.
  ///
  /// In en, this message translates to:
  /// **'Hide password'**
  String get hidePassword;

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

  /// No description provided for @selectedBirthplace.
  ///
  /// In en, this message translates to:
  /// **'Selected birthplace'**
  String get selectedBirthplace;

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

  /// No description provided for @noBirthProfilesTitle.
  ///
  /// In en, this message translates to:
  /// **'No birth profile yet'**
  String get noBirthProfilesTitle;

  /// No description provided for @noBirthProfilesBody.
  ///
  /// In en, this message translates to:
  /// **'Create a birth profile to get started.'**
  String get noBirthProfilesBody;

  /// No description provided for @onboardingIntro.
  ///
  /// In en, this message translates to:
  /// **'Add your birth date, time, and place so KundlInsights can prepare your profile and personalized insights.'**
  String get onboardingIntro;

  /// No description provided for @resolvingBirthDetails.
  ///
  /// In en, this message translates to:
  /// **'Resolving birth details…'**
  String get resolvingBirthDetails;

  /// No description provided for @creatingProfile.
  ///
  /// In en, this message translates to:
  /// **'Creating profile…'**
  String get creatingProfile;

  /// No description provided for @birthDetails.
  ///
  /// In en, this message translates to:
  /// **'Birth details'**
  String get birthDetails;

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

  /// No description provided for @noPlanets.
  ///
  /// In en, this message translates to:
  /// **'No planets'**
  String get noPlanets;

  /// No description provided for @chartAccessibleHouseList.
  ///
  /// In en, this message translates to:
  /// **'Accessible house list'**
  String get chartAccessibleHouseList;

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

  /// No description provided for @d1.
  ///
  /// In en, this message translates to:
  /// **'D1'**
  String get d1;

  /// No description provided for @d9.
  ///
  /// In en, this message translates to:
  /// **'D9'**
  String get d9;

  /// No description provided for @d10.
  ///
  /// In en, this message translates to:
  /// **'D10'**
  String get d10;

  /// No description provided for @navamsa.
  ///
  /// In en, this message translates to:
  /// **'Navamsa (D9)'**
  String get navamsa;

  /// No description provided for @dasamsa.
  ///
  /// In en, this message translates to:
  /// **'Dasamsa (D10)'**
  String get dasamsa;

  /// No description provided for @divisionalChart.
  ///
  /// In en, this message translates to:
  /// **'Divisional Chart'**
  String get divisionalChart;

  /// No description provided for @divisionalChartUnavailable.
  ///
  /// In en, this message translates to:
  /// **'This divisional chart is unavailable right now. Please try again.'**
  String get divisionalChartUnavailable;

  /// No description provided for @currentDasha.
  ///
  /// In en, this message translates to:
  /// **'Current Dasha'**
  String get currentDasha;

  /// No description provided for @currentDashaLoading.
  ///
  /// In en, this message translates to:
  /// **'Current Dasha loading'**
  String get currentDashaLoading;

  /// No description provided for @currentMahadasha.
  ///
  /// In en, this message translates to:
  /// **'Current Mahadasha'**
  String get currentMahadasha;

  /// No description provided for @currentAntardasha.
  ///
  /// In en, this message translates to:
  /// **'Current Antardasha'**
  String get currentAntardasha;

  /// No description provided for @currentPratyantardasha.
  ///
  /// In en, this message translates to:
  /// **'Current Pratyantardasha'**
  String get currentPratyantardasha;

  /// No description provided for @viewFullDashaTimeline.
  ///
  /// In en, this message translates to:
  /// **'View full Dasha timeline'**
  String get viewFullDashaTimeline;

  /// No description provided for @vimshottariTimeline.
  ///
  /// In en, this message translates to:
  /// **'Vimshottari Dasha'**
  String get vimshottariTimeline;

  /// No description provided for @vimshottariTimelineLoading.
  ///
  /// In en, this message translates to:
  /// **'Vimshottari timeline loading'**
  String get vimshottariTimelineLoading;

  /// No description provided for @vimshottariUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your Vimshottari data is unavailable right now. Please try again.'**
  String get vimshottariUnavailable;

  /// No description provided for @dashaLevel.
  ///
  /// In en, this message translates to:
  /// **'Dasha level'**
  String get dashaLevel;

  /// No description provided for @timelineWindow.
  ///
  /// In en, this message translates to:
  /// **'Timeline window'**
  String get timelineWindow;

  /// No description provided for @nextOneYear.
  ///
  /// In en, this message translates to:
  /// **'Next 1 year'**
  String get nextOneYear;

  /// No description provided for @nextThreeYears.
  ///
  /// In en, this message translates to:
  /// **'Next 3 years'**
  String get nextThreeYears;

  /// No description provided for @nextFiveYears.
  ///
  /// In en, this message translates to:
  /// **'Next 5 years'**
  String get nextFiveYears;

  /// No description provided for @mahadasha.
  ///
  /// In en, this message translates to:
  /// **'Mahadasha'**
  String get mahadasha;

  /// No description provided for @antardasha.
  ///
  /// In en, this message translates to:
  /// **'Antardasha'**
  String get antardasha;

  /// No description provided for @pratyantardasha.
  ///
  /// In en, this message translates to:
  /// **'Pratyantardasha'**
  String get pratyantardasha;

  /// No description provided for @starts.
  ///
  /// In en, this message translates to:
  /// **'Starts'**
  String get starts;

  /// No description provided for @ends.
  ///
  /// In en, this message translates to:
  /// **'Ends'**
  String get ends;

  /// No description provided for @ashtakavarga.
  ///
  /// In en, this message translates to:
  /// **'Ashtakavarga'**
  String get ashtakavarga;

  /// No description provided for @sarvashtakavarga.
  ///
  /// In en, this message translates to:
  /// **'Sarvashtakavarga'**
  String get sarvashtakavarga;

  /// No description provided for @sav.
  ///
  /// In en, this message translates to:
  /// **'SAV'**
  String get sav;

  /// No description provided for @bhinnashtakavarga.
  ///
  /// In en, this message translates to:
  /// **'Bhinnashtakavarga'**
  String get bhinnashtakavarga;

  /// No description provided for @bav.
  ///
  /// In en, this message translates to:
  /// **'BAV'**
  String get bav;

  /// No description provided for @lagnaBav.
  ///
  /// In en, this message translates to:
  /// **'Lagna BAV'**
  String get lagnaBav;

  /// No description provided for @score.
  ///
  /// In en, this message translates to:
  /// **'Score'**
  String get score;

  /// No description provided for @sun.
  ///
  /// In en, this message translates to:
  /// **'Sun'**
  String get sun;

  /// No description provided for @moon.
  ///
  /// In en, this message translates to:
  /// **'Moon'**
  String get moon;

  /// No description provided for @mars.
  ///
  /// In en, this message translates to:
  /// **'Mars'**
  String get mars;

  /// No description provided for @mercury.
  ///
  /// In en, this message translates to:
  /// **'Mercury'**
  String get mercury;

  /// No description provided for @jupiter.
  ///
  /// In en, this message translates to:
  /// **'Jupiter'**
  String get jupiter;

  /// No description provided for @venus.
  ///
  /// In en, this message translates to:
  /// **'Venus'**
  String get venus;

  /// No description provided for @saturn.
  ///
  /// In en, this message translates to:
  /// **'Saturn'**
  String get saturn;

  /// No description provided for @loading.
  ///
  /// In en, this message translates to:
  /// **'Loading'**
  String get loading;

  /// No description provided for @noData.
  ///
  /// In en, this message translates to:
  /// **'No data'**
  String get noData;

  /// No description provided for @ashtakavargaUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your Ashtakavarga data is unavailable right now. Please try again.'**
  String get ashtakavargaUnavailable;

  /// No description provided for @careerCalibration.
  ///
  /// In en, this message translates to:
  /// **'Career History'**
  String get careerCalibration;

  /// No description provided for @careerCalibrationIntro.
  ///
  /// In en, this message translates to:
  /// **'Add career milestones to help personalize future Career Readings. You can enter an exact date, month, or year.'**
  String get careerCalibrationIntro;

  /// No description provided for @addMilestone.
  ///
  /// In en, this message translates to:
  /// **'Add milestone'**
  String get addMilestone;

  /// No description provided for @editMilestone.
  ///
  /// In en, this message translates to:
  /// **'Edit milestone'**
  String get editMilestone;

  /// No description provided for @saveChanges.
  ///
  /// In en, this message translates to:
  /// **'Save changes'**
  String get saveChanges;

  /// No description provided for @eventType.
  ///
  /// In en, this message translates to:
  /// **'Event type'**
  String get eventType;

  /// No description provided for @datePrecision.
  ///
  /// In en, this message translates to:
  /// **'Date precision'**
  String get datePrecision;

  /// No description provided for @year.
  ///
  /// In en, this message translates to:
  /// **'Year'**
  String get year;

  /// No description provided for @month.
  ///
  /// In en, this message translates to:
  /// **'Month'**
  String get month;

  /// No description provided for @day.
  ///
  /// In en, this message translates to:
  /// **'Day'**
  String get day;

  /// No description provided for @titleOptional.
  ///
  /// In en, this message translates to:
  /// **'Title (optional)'**
  String get titleOptional;

  /// No description provided for @notesOptional.
  ///
  /// In en, this message translates to:
  /// **'Notes (optional)'**
  String get notesOptional;

  /// No description provided for @noCareerHistory.
  ///
  /// In en, this message translates to:
  /// **'No career history added'**
  String get noCareerHistory;

  /// No description provided for @addAnotherMilestone.
  ///
  /// In en, this message translates to:
  /// **'Add another milestone to build your Career History.'**
  String get addAnotherMilestone;

  /// No description provided for @careerHistoryReady.
  ///
  /// In en, this message translates to:
  /// **'Your Career History is ready for future Career Readings.'**
  String get careerHistoryReady;

  /// No description provided for @careerEventsUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Your career milestones are unavailable right now. Please try again.'**
  String get careerEventsUnavailable;

  /// No description provided for @deleteCareerMilestone.
  ///
  /// In en, this message translates to:
  /// **'Delete this career milestone?'**
  String get deleteCareerMilestone;

  /// No description provided for @deleteCareerMilestoneBody.
  ///
  /// In en, this message translates to:
  /// **'It will be removed from your Career History.'**
  String get deleteCareerMilestoneBody;

  /// No description provided for @delete.
  ///
  /// In en, this message translates to:
  /// **'Delete'**
  String get delete;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @careerEventFuture.
  ///
  /// In en, this message translates to:
  /// **'Career milestones must not be in the future.'**
  String get careerEventFuture;

  /// No description provided for @invalidCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Please complete the required milestone details.'**
  String get invalidCareerEvent;

  /// No description provided for @firstJob.
  ///
  /// In en, this message translates to:
  /// **'First job'**
  String get firstJob;

  /// No description provided for @jobSwitch.
  ///
  /// In en, this message translates to:
  /// **'Job switch'**
  String get jobSwitch;

  /// No description provided for @promotion.
  ///
  /// In en, this message translates to:
  /// **'Promotion'**
  String get promotion;

  /// No description provided for @roleChange.
  ///
  /// In en, this message translates to:
  /// **'Role change'**
  String get roleChange;

  /// No description provided for @salaryGrowth.
  ///
  /// In en, this message translates to:
  /// **'Salary growth'**
  String get salaryGrowth;

  /// No description provided for @jobLoss.
  ///
  /// In en, this message translates to:
  /// **'Job loss'**
  String get jobLoss;

  /// No description provided for @businessStarted.
  ///
  /// In en, this message translates to:
  /// **'Business started'**
  String get businessStarted;

  /// No description provided for @careerBreakthrough.
  ///
  /// In en, this message translates to:
  /// **'Career breakthrough'**
  String get careerBreakthrough;

  /// No description provided for @careerSetback.
  ///
  /// In en, this message translates to:
  /// **'Career setback'**
  String get careerSetback;

  /// No description provided for @other.
  ///
  /// In en, this message translates to:
  /// **'Other'**
  String get other;

  /// No description provided for @addCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Add career event'**
  String get addCareerEvent;

  /// No description provided for @editCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Edit career event'**
  String get editCareerEvent;

  /// No description provided for @deleteCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Delete career event?'**
  String get deleteCareerEvent;

  /// No description provided for @exactDate.
  ///
  /// In en, this message translates to:
  /// **'Exact date'**
  String get exactDate;

  /// No description provided for @monthAndYear.
  ///
  /// In en, this message translates to:
  /// **'Month and year'**
  String get monthAndYear;

  /// No description provided for @yearOnly.
  ///
  /// In en, this message translates to:
  /// **'Year only'**
  String get yearOnly;

  /// No description provided for @careerHistoryLoading.
  ///
  /// In en, this message translates to:
  /// **'Loading career history…'**
  String get careerHistoryLoading;

  /// No description provided for @careerHistoryEmptyBody.
  ///
  /// In en, this message translates to:
  /// **'Add career milestones to build your Career History for future Career Readings.'**
  String get careerHistoryEmptyBody;

  /// No description provided for @creatingCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Adding career event…'**
  String get creatingCareerEvent;

  /// No description provided for @savingCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Saving changes…'**
  String get savingCareerEvent;

  /// No description provided for @deletingCareerEvent.
  ///
  /// In en, this message translates to:
  /// **'Deleting career event…'**
  String get deletingCareerEvent;

  /// No description provided for @careerEventInvalidDate.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid historical date.'**
  String get careerEventInvalidDate;

  /// No description provided for @careerProfileChanged.
  ///
  /// In en, this message translates to:
  /// **'Your active profile changed. This form can no longer be submitted.'**
  String get careerProfileChanged;

  /// No description provided for @discardCareerChanges.
  ///
  /// In en, this message translates to:
  /// **'Discard changes?'**
  String get discardCareerChanges;

  /// No description provided for @discardCareerChangesBody.
  ///
  /// In en, this message translates to:
  /// **'Your unsaved changes will be lost.'**
  String get discardCareerChangesBody;

  /// No description provided for @keepEditing.
  ///
  /// In en, this message translates to:
  /// **'Keep editing'**
  String get keepEditing;

  /// No description provided for @discard.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discard;

  /// No description provided for @dismiss.
  ///
  /// In en, this message translates to:
  /// **'Dismiss'**
  String get dismiss;

  /// No description provided for @careerReadingEntryBody.
  ///
  /// In en, this message translates to:
  /// **'Your Career History milestones help personalize this backend-generated Career Reading.'**
  String get careerReadingEntryBody;

  /// No description provided for @careerGenerationFailed.
  ///
  /// In en, this message translates to:
  /// **'We could not prepare your Career Reading. Your Career History is still available.'**
  String get careerGenerationFailed;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @careerReadingAvailable.
  ///
  /// In en, this message translates to:
  /// **'Your Career Reading is ready.'**
  String get careerReadingAvailable;

  /// No description provided for @viewCareerReading.
  ///
  /// In en, this message translates to:
  /// **'View Career Reading'**
  String get viewCareerReading;

  /// No description provided for @careerReadingProfileUnavailable.
  ///
  /// In en, this message translates to:
  /// **'Career Reading isn\'t available for this profile right now.'**
  String get careerReadingProfileUnavailable;

  /// No description provided for @somethingWentWrong.
  ///
  /// In en, this message translates to:
  /// **'Something went wrong'**
  String get somethingWentWrong;

  /// No description provided for @premium.
  ///
  /// In en, this message translates to:
  /// **'Premium'**
  String get premium;

  /// No description provided for @northIndianChartSummary.
  ///
  /// In en, this message translates to:
  /// **'North Indian {chartLabel} chart. {summary}'**
  String northIndianChartSummary(Object chartLabel, Object summary);

  /// No description provided for @northIndianHouseSemantics.
  ///
  /// In en, this message translates to:
  /// **'House {house}, {sign}, {planets}'**
  String northIndianHouseSemantics(Object house, Object sign, Object planets);

  /// No description provided for @northIndianHouseSummary.
  ///
  /// In en, this message translates to:
  /// **'House {house}, {sign}'**
  String northIndianHouseSummary(Object house, Object sign);

  /// No description provided for @retrogradeAbbreviation.
  ///
  /// In en, this message translates to:
  /// **'(R)'**
  String get retrogradeAbbreviation;

  /// No description provided for @lagna.
  ///
  /// In en, this message translates to:
  /// **'Lagna'**
  String get lagna;
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
