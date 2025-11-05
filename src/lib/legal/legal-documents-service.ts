/**
 * Legal Documents Service
 * Handles fetching, caching, and version management of legal documents
 * Requirements: 8.1, 8.2, 8.3, 8.7, 8.10
 */

import { storage } from '@/lib/storage';
import type { LegalDocument, LegalDocumentType } from '@/types/settings';

const CACHE_KEY_PREFIX = 'legal.documents';
const CACHE_TIMESTAMP_KEY = 'legal.documents.last_synced';

/**
 * Mock legal documents for initial implementation
 * In production, these would be fetched from the backend
 */
const MOCK_DOCUMENTS: Record<LegalDocumentType, LegalDocument> = {
  terms: {
    type: 'terms',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    content: {
      en: `# Terms of Service

Last Updated: ${new Date().toLocaleDateString('en-US')}

## 1. Acceptance of Terms

By accessing and using GrowBro, you accept and agree to be bound by the terms and provision of this agreement.

## 2. Use License

Permission is granted to temporarily download one copy of GrowBro for personal, non-commercial transitory viewing only.

## 3. Educational Purpose

GrowBro is provided for educational purposes only. Users are responsible for complying with local laws regarding cannabis cultivation.

## 4. User Responsibilities

- You must be of legal age to use this application
- You are responsible for maintaining the confidentiality of your account
- You agree not to use the service for any unlawful purpose

## 5. Privacy

Your use of GrowBro is also governed by our Privacy Policy.

## 6. Modifications

We reserve the right to modify these terms at any time. Material changes will require your re-acceptance.

## 7. Termination

We may terminate or suspend access to our service immediately, without prior notice or liability, for any reason whatsoever.

## 8. Limitation of Liability

In no event shall GrowBro be liable for any indirect, incidental, special, consequential or punitive damages.

## 9. Governing Law

These terms shall be governed by the laws of the jurisdiction in which GrowBro operates.

## 10. Contact

For questions about these Terms, please contact us at legal@growbro.app.`,
      de: `# Nutzungsbedingungen

Zuletzt aktualisiert: ${new Date().toLocaleDateString('de-DE')}

## 1. Annahme der Bedingungen

Durch den Zugriff auf und die Nutzung von GrowBro akzeptieren Sie diese Nutzungsbedingungen.

## 2. Nutzungslizenz

Es wird die Erlaubnis erteilt, eine Kopie von GrowBro für persönliche, nicht-kommerzielle Zwecke herunterzuladen.

## 3. Bildungszweck

GrowBro wird nur zu Bildungszwecken bereitgestellt. Nutzer sind für die Einhaltung lokaler Gesetze zum Cannabis-Anbau verantwortlich.

## 4. Nutzerverantwortlichkeiten

- Sie müssen volljährig sein, um diese Anwendung zu nutzen
- Sie sind für die Vertraulichkeit Ihres Kontos verantwortlich
- Sie verpflichten sich, den Dienst nicht für rechtswidrige Zwecke zu nutzen

## 5. Datenschutz

Ihre Nutzung von GrowBro unterliegt auch unserer Datenschutzrichtlinie.

## 6. Änderungen

Wir behalten uns das Recht vor, diese Bedingungen jederzeit zu ändern. Wesentliche Änderungen erfordern Ihre erneute Zustimmung.

## 7. Kündigung

Wir können den Zugang zu unserem Dienst jederzeit ohne Vorankündigung beenden oder aussetzen.

## 8. Haftungsbeschränkung

GrowBro haftet nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden.

## 9. Anwendbares Recht

Diese Bedingungen unterliegen den Gesetzen der Gerichtsbarkeit, in der GrowBro tätig ist.

## 10. Kontakt

Bei Fragen zu diesen Bedingungen kontaktieren Sie uns bitte unter legal@growbro.app.`,
    },
    requiresReAcceptance: false,
  },
  privacy: {
    type: 'privacy',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    content: {
      en: `# Privacy Policy

Last Updated: ${new Date().toLocaleDateString('en-US')}

## Introduction

GrowBro ("we", "our", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information.

## Information We Collect

### Information You Provide
- Account information (email, display name)
- Profile data (bio, avatar, location)
- User content (plants, tasks, harvests, posts)
- Support requests and feedback

### Automatically Collected Information
- Device information (model, OS version)
- Usage data (app interactions, features used)
- Log data (IP address, timestamps)
- Crash reports and diagnostics (with your consent)

## How We Use Your Information

- **Provide Services**: To operate and maintain GrowBro
- **Improve Experience**: To enhance features and user experience
- **Communication**: To send notifications and respond to inquiries
- **Analytics**: To understand usage patterns (with your consent)
- **Security**: To protect against fraud and abuse

## Data Sharing

We do not sell your personal information. We may share data with:
- **Service Providers**: Cloud hosting, analytics, crash reporting
- **Legal Requirements**: When required by law or to protect rights
- **With Your Consent**: When you explicitly authorize sharing

## Your Rights (GDPR)

- **Access**: Request a copy of your data
- **Rectification**: Correct inaccurate data
- **Erasure**: Request deletion of your data
- **Portability**: Receive your data in a portable format
- **Object**: Opt-out of certain processing
- **Withdraw Consent**: At any time, for consent-based processing

## Data Retention

- Account data: Retained while your account is active
- Deleted data: Permanently removed after 30-day grace period
- Legal records: Consent logs retained up to 5 years
- Backups: Removed within 90 days of deletion

## Security

We implement industry-standard security measures including:
- Encryption in transit (HTTPS) and at rest
- Access controls and authentication
- Regular security audits
- Secure storage using Supabase

## International Transfers

Your data may be transferred to servers located outside your jurisdiction. We ensure adequate safeguards are in place.

## Children's Privacy

GrowBro is not intended for users under 18 (or 21 in certain jurisdictions). We do not knowingly collect data from minors.

## Changes to This Policy

We may update this Privacy Policy. Material changes will be notified via email or in-app notification.

## Contact Us

For privacy inquiries, contact:
- Email: privacy@growbro.app
- Data Protection Officer: dpo@growbro.app

## Your Privacy Choices

You can manage your privacy settings in the app under Settings > Privacy & Data.`,
      de: `# Datenschutzrichtlinie

Zuletzt aktualisiert: ${new Date().toLocaleDateString('de-DE')}

## Einleitung

GrowBro („wir", „unser", „uns") verpflichtet sich zum Schutz Ihrer Privatsphäre. Diese Datenschutzrichtlinie erklärt, wie wir Ihre Informationen sammeln, verwenden, offenlegen und schützen.

## Welche Informationen wir sammeln

### Von Ihnen bereitgestellte Informationen
- Kontoinformationen (E-Mail, Anzeigename)
- Profildaten (Bio, Avatar, Standort)
- Benutzerinhalte (Pflanzen, Aufgaben, Ernten, Beiträge)
- Support-Anfragen und Feedback

### Automatisch gesammelte Informationen
- Geräteinformationen (Modell, Betriebssystemversion)
- Nutzungsdaten (App-Interaktionen, verwendete Funktionen)
- Protokolldaten (IP-Adresse, Zeitstempel)
- Absturzberichte und Diagnosen (mit Ihrer Zustimmung)

## Wie wir Ihre Informationen verwenden

- **Dienste bereitstellen**: Zum Betrieb und zur Wartung von GrowBro
- **Erlebnis verbessern**: Zur Verbesserung von Funktionen und Benutzererfahrung
- **Kommunikation**: Zum Senden von Benachrichtigungen und Beantworten von Anfragen
- **Analysen**: Zum Verständnis von Nutzungsmustern (mit Ihrer Zustimmung)
- **Sicherheit**: Zum Schutz vor Betrug und Missbrauch

## Datenweitergabe

Wir verkaufen Ihre personenbezogenen Daten nicht. Wir können Daten weitergeben an:
- **Dienstleister**: Cloud-Hosting, Analysen, Absturzmeldungen
- **Gesetzliche Anforderungen**: Wenn gesetzlich vorgeschrieben oder zum Schutz von Rechten
- **Mit Ihrer Zustimmung**: Wenn Sie die Weitergabe ausdrücklich autorisieren

## Ihre Rechte (DSGVO)

- **Zugang**: Eine Kopie Ihrer Daten anfordern
- **Berichtigung**: Unrichtige Daten korrigieren
- **Löschung**: Löschung Ihrer Daten beantragen
- **Datenübertragbarkeit**: Ihre Daten in einem übertragbaren Format erhalten
- **Widerspruch**: Bestimmter Verarbeitung widersprechen
- **Widerruf der Einwilligung**: Jederzeit, für auf Einwilligung basierende Verarbeitung

## Datenspeicherung

- Kontodaten: Gespeichert, solange Ihr Konto aktiv ist
- Gelöschte Daten: Dauerhaft entfernt nach 30-tägiger Karenzzeit
- Rechtliche Aufzeichnungen: Einwilligungsprotokolle bis zu 5 Jahre aufbewahrt
- Backups: Innerhalb von 90 Tagen nach Löschung entfernt

## Sicherheit

Wir implementieren branchenübliche Sicherheitsmaßnahmen, einschließlich:
- Verschlüsselung bei Übertragung (HTTPS) und im Ruhezustand
- Zugriffskontrollen und Authentifizierung
- Regelmäßige Sicherheitsaudits
- Sichere Speicherung mit Supabase

## Internationale Übertragungen

Ihre Daten können auf Server außerhalb Ihrer Gerichtsbarkeit übertragen werden. Wir stellen sicher, dass angemessene Schutzmaßnahmen vorhanden sind.

## Datenschutz für Kinder

GrowBro ist nicht für Benutzer unter 18 Jahren (oder 21 in bestimmten Gerichtsbarkeiten) bestimmt. Wir sammeln wissentlich keine Daten von Minderjährigen.

## Änderungen an dieser Richtlinie

Wir können diese Datenschutzrichtlinie aktualisieren. Wesentliche Änderungen werden per E-Mail oder In-App-Benachrichtigung mitgeteilt.

## Kontaktieren Sie uns

Bei Datenschutzanfragen kontaktieren Sie:
- E-Mail: privacy@growbro.app
- Datenschutzbeauftragter: dpo@growbro.app

## Ihre Datenschutzeinstellungen

Sie können Ihre Datenschutzeinstellungen in der App unter Einstellungen > Datenschutz & Daten verwalten.`,
    },
    requiresReAcceptance: false,
  },
  cannabis: {
    type: 'cannabis',
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    content: {
      en: `# Cannabis Cultivation Responsibility

Last Updated: ${new Date().toLocaleDateString('en-US')}

## Educational Purpose

GrowBro is an educational application designed to help users learn about and track cannabis cultivation. The app does not promote, encourage, or facilitate illegal activities.

## User Responsibility

**YOU ARE SOLELY RESPONSIBLE FOR:**

1. **Legal Compliance**: Understanding and complying with all local, state/provincial, and federal laws regarding cannabis cultivation in your jurisdiction
2. **Age Requirements**: Ensuring you meet the minimum age requirements (18+ or 21+ depending on jurisdiction)
3. **Permit Compliance**: Obtaining any required licenses, permits, or medical authorizations
4. **Plant Limits**: Adhering to legal plant count limits in your area
5. **Private Use**: Ensuring cultivation is for personal use where legal, not for distribution or sale

## Legal Disclaimer

- Cannabis cultivation remains **illegal** in many jurisdictions
- Even where legal, strict regulations apply regarding plant counts, possession limits, and cultivation locations
- Laws vary significantly by country, state/province, and municipality
- GrowBro does **not** provide legal advice
- Consult with legal counsel if you have questions about cannabis laws in your area

## Jurisdictional Restrictions

GrowBro may be restricted or unavailable in jurisdictions where cannabis cultivation is illegal. By using GrowBro, you confirm that:

- You are located in a jurisdiction where cannabis cultivation is legal
- You meet all age and permit requirements
- Your intended use complies with applicable laws
- You will not use the app to facilitate illegal activities

## Medical Use

If you are cultivating cannabis for medical purposes:

- Ensure you have proper medical authorization
- Follow all regulations regarding medical cannabis cultivation
- Maintain required documentation
- Adhere to medical cannabis program rules in your jurisdiction

## No Guarantee

GrowBro provides educational information only. We make no guarantees regarding:

- Legal compliance of cultivation practices
- Success or yield of cultivation efforts
- Accuracy of third-party information
- Suitability for specific medical conditions

## Prohibition on Illegal Activity

Users may not:

- Use GrowBro to facilitate illegal drug trafficking or distribution
- Promote illegal cultivation in restricted jurisdictions
- Share content that violates local laws
- Use the app for commercial cultivation without proper licensing

## Law Enforcement

We cooperate with law enforcement when legally required and may report suspected illegal activity to authorities.

## Acknowledgment

By using GrowBro, you acknowledge that:

- You have read and understood this policy
- You accept full responsibility for your cultivation activities
- You will comply with all applicable laws
- Violation of laws may result in criminal penalties including fines and imprisonment
- GrowBro is not liable for any legal consequences of your actions

## Updates

We may update this policy as laws change. Continued use after updates constitutes acceptance.

## Contact

For questions about this policy: legal@growbro.app

**IMPORTANT: IF CANNABIS CULTIVATION IS ILLEGAL IN YOUR JURISDICTION, DO NOT USE THIS APPLICATION.**`,
      de: `# Verantwortung beim Cannabis-Anbau

Zuletzt aktualisiert: ${new Date().toLocaleDateString('de-DE')}

## Bildungszweck

GrowBro ist eine Bildungsanwendung, die Benutzern helfen soll, mehr über den Cannabis-Anbau zu erfahren und diesen zu verfolgen. Die App fördert, ermutigt oder erleichtert keine illegalen Aktivitäten.

## Benutzerverantwortung

**SIE SIND ALLEIN VERANTWORTLICH FÜR:**

1. **Rechtliche Compliance**: Das Verständnis und die Einhaltung aller lokalen, bundesstaatlichen und föderalen Gesetze bezüglich des Cannabis-Anbaus in Ihrer Gerichtsbarkeit
2. **Altersanforderungen**: Sicherstellen, dass Sie die Mindestalteranforderungen erfüllen (18+ oder 21+ je nach Gerichtsbarkeit)
3. **Genehmigungskonformität**: Erhalt aller erforderlichen Lizenzen, Genehmigungen oder medizinischen Autorisierungen
4. **Pflanzenlimits**: Einhaltung gesetzlicher Pflanzenzahlgrenzen in Ihrer Region
5. **Private Nutzung**: Sicherstellen, dass der Anbau für den persönlichen Gebrauch erfolgt, wo legal, nicht für Vertrieb oder Verkauf

## Rechtlicher Haftungsausschluss

- Der Cannabis-Anbau bleibt in vielen Gerichtsbarkeiten **illegal**
- Selbst wo legal, gelten strenge Vorschriften bezüglich Pflanzenzahlen, Besitzgrenzen und Anbauorten
- Gesetze variieren erheblich nach Land, Bundesland/Provinz und Gemeinde
- GrowBro bietet **keine** Rechtsberatung
- Konsultieren Sie einen Rechtsanwalt, wenn Sie Fragen zu Cannabis-Gesetzen in Ihrer Region haben

## Gerichtsstandsbeschränkungen

GrowBro kann in Gerichtsbarkeiten, in denen der Cannabis-Anbau illegal ist, eingeschränkt oder nicht verfügbar sein. Durch die Nutzung von GrowBro bestätigen Sie, dass:

- Sie sich in einer Gerichtsbarkeit befinden, in der der Cannabis-Anbau legal ist
- Sie alle Alters- und Genehmigungsanforderungen erfüllen
- Ihre beabsichtigte Nutzung den geltenden Gesetzen entspricht
- Sie die App nicht verwenden werden, um illegale Aktivitäten zu erleichtern

## Medizinische Verwendung

Wenn Sie Cannabis zu medizinischen Zwecken anbauen:

- Stellen Sie sicher, dass Sie über eine ordnungsgemäße medizinische Genehmigung verfügen
- Befolgen Sie alle Vorschriften zum medizinischen Cannabis-Anbau
- Bewahren Sie erforderliche Dokumentation auf
- Halten Sie sich an die Regeln des medizinischen Cannabis-Programms in Ihrer Gerichtsbarkeit

## Keine Garantie

GrowBro bietet nur Bildungsinformationen. Wir geben keine Garantien bezüglich:

- Rechtlicher Compliance von Anbau praktiken
- Erfolg oder Ertrag von Anbaubemühungen
- Genauigkeit von Informationen Dritter
- Eignung für spezifische medizinische Bedingungen

## Verbot illegaler Aktivitäten

Benutzer dürfen nicht:

- GrowBro verwenden, um illegalen Drogenhandel oder Vertrieb zu erleichtern
- Illegalen Anbau in eingeschränkten Gerichtsbarkeiten fördern
- Inhalte teilen, die lokale Gesetze verletzen
- Die App für kommerziellen Anbau ohne ordnungsgemäße Lizenzierung verwenden

## Strafverfolgung

Wir arbeiten mit Strafverfolgungsbehörden zusammen, wenn gesetzlich erforderlich, und können vermutete illegale Aktivitäten den Behörden melden.

## Anerkennung

Durch die Nutzung von GrowBro erkennen Sie an, dass:

- Sie diese Richtlinie gelesen und verstanden haben
- Sie die volle Verantwortung für Ihre Anbauaktivitäten übernehmen
- Sie alle geltenden Gesetze einhalten werden
- Verstöße gegen Gesetze zu strafrechtlichen Sanktionen einschließlich Geldstrafen und Freiheitsstrafe führen können
- GrowBro nicht für rechtliche Konsequenzen Ihrer Handlungen haftbar ist

## Aktualisierungen

Wir können diese Richtlinie aktualisieren, wenn sich Gesetze ändern. Die fortgesetzte Nutzung nach Aktualisierungen stellt eine Annahme dar.

## Kontakt

Bei Fragen zu dieser Richtlinie: legal@growbro.app

**WICHTIG: WENN DER CANNABIS-ANBAU IN IHRER GERICHTSBARKEIT ILLEGAL IST, VERWENDEN SIE DIESE ANWENDUNG NICHT.**`,
    },
    requiresReAcceptance: false,
  },
};

/**
 * Get a legal document from cache or mock data
 */
export async function getLegalDocument(
  type: LegalDocumentType,
  _locale: 'en' | 'de' = 'en'
): Promise<LegalDocument | null> {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}.${type}`;
    const cached = storage.getString(cacheKey);

    if (cached) {
      const document: LegalDocument = JSON.parse(cached);
      return document;
    }

    // Return mock document
    const document = MOCK_DOCUMENTS[type];
    if (document) {
      // Cache the document
      storage.set(cacheKey, JSON.stringify(document));
      return document;
    }

    return null;
  } catch (error) {
    console.error('Error fetching legal document:', error);
    return null;
  }
}

/**
 * Get all legal documents
 */
export async function getAllLegalDocuments(
  _locale: 'en' | 'de' = 'en'
): Promise<Record<LegalDocumentType, LegalDocument>> {
  const documents = await Promise.all([
    getLegalDocument('terms', _locale),
    getLegalDocument('privacy', _locale),
    getLegalDocument('cannabis', _locale),
  ]);

  return {
    terms: documents[0]!,
    privacy: documents[1]!,
    cannabis: documents[2]!,
  };
}

/**
 * Get the last sync timestamp
 */
export function getLastSyncTimestamp(): string | undefined {
  return storage.getString(CACHE_TIMESTAMP_KEY);
}

/**
 * Update the last sync timestamp
 */
export function updateLastSyncTimestamp(): void {
  storage.set(CACHE_TIMESTAMP_KEY, new Date().toISOString());
}

/**
 * Clear all cached documents
 */
export function clearLegalDocumentCache(): void {
  const types: LegalDocumentType[] = ['terms', 'privacy', 'cannabis'];
  types.forEach((type) => {
    const cacheKey = `${CACHE_KEY_PREFIX}.${type}`;
    storage.delete(cacheKey);
  });
  storage.delete(CACHE_TIMESTAMP_KEY);
}

/**
 * Compare semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }

  return 0;
}

/**
 * Check if version bump is a major version increase
 */
export function isMajorVersionBump(
  oldVersion: string,
  newVersion: string
): boolean {
  const oldMajor = parseInt(oldVersion.split('.')[0] || '0', 10);
  const newMajor = parseInt(newVersion.split('.')[0] || '0', 10);
  return newMajor > oldMajor;
}

/**
 * Check if any legal document has been updated
 * Returns documents that need re-acceptance (major version bump)
 */
export async function checkForLegalUpdates(
  lastAcceptedVersions: Record<LegalDocumentType, string>
): Promise<LegalDocumentType[]> {
  const documents = await getAllLegalDocuments();
  const needsReAcceptance: LegalDocumentType[] = [];

  (Object.keys(documents) as LegalDocumentType[]).forEach((type) => {
    const document = documents[type];
    const lastAccepted = lastAcceptedVersions[type];

    if (lastAccepted && isMajorVersionBump(lastAccepted, document.version)) {
      needsReAcceptance.push(type);
    }
  });

  return needsReAcceptance;
}
