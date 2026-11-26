// Synthetic records for browser layout tests. These URLs are never requested by the suite.
const examples = [
  ["Fixture · Sample winner", "NG"],
  ["اسم تجريبي للتأكد من التفاف الأسماء الطويلة", "EG"],
  ["Contoh Nama Pemenang dengan Beberapa Bagian", "ID"],
  ["نمونے کے لیے ایک طویل فرضی نام", "PK"],
  ["FixtureLongUnbrokenWinnerNameForNarrowViewportWrappingChecks", "GB"],
];

export const fixtureArchive = {
  schemaVersion: 1,
  presentationEnabled: true,
  updatedAt: "2020-04-01T00:00:00Z",
  ramadanUmrah: null,
  records: Array.from({ length: 55 }, (_, index) => {
    const number = index + 1;
    const [name, country] = examples[index % examples.length];
    return {
      id: "winner-" + String(number).padStart(4, "0"),
      displayName: `${name} ${number}`,
      country,
      prize: "umrah",
      announcedOn: new Date(Date.UTC(2020, 0, number)).toISOString().slice(0, 10),
      winnerOrdinal: number,
      announcementUrl: `https://www.nusuk.sa/qa-fixture/winner-${number}`,
      verifiedAt: "2020-04-01T00:00:00Z",
    };
  }),
};
