// the bundled sample directory, served when no backend is configured.
//
// a representative slice of the real sec exchange-annotated tickers file:
// well-known companies across both major exchanges, so search, filter,
// sort, and export all behave meaningfully in demo mode.

export interface DirectoryCompany {
  cik: string;
  name: string;
  ticker: string;
  exchange: string;
}

export const SAMPLE_DIRECTORY: DirectoryCompany[] = [
  { cik: "0000320193", name: "Apple Inc.", ticker: "AAPL", exchange: "Nasdaq" },
  { cik: "0001045810", name: "NVIDIA CORP", ticker: "NVDA", exchange: "Nasdaq" },
  { cik: "0000789019", name: "MICROSOFT CORP", ticker: "MSFT", exchange: "Nasdaq" },
  { cik: "0001652044", name: "Alphabet Inc.", ticker: "GOOGL", exchange: "Nasdaq" },
  { cik: "0001018724", name: "AMAZON COM INC", ticker: "AMZN", exchange: "Nasdaq" },
  { cik: "0001326801", name: "Meta Platforms, Inc.", ticker: "META", exchange: "Nasdaq" },
  { cik: "0001318605", name: "Tesla, Inc.", ticker: "TSLA", exchange: "Nasdaq" },
  { cik: "0000002488", name: "ADVANCED MICRO DEVICES INC", ticker: "AMD", exchange: "Nasdaq" },
  { cik: "0000050863", name: "INTEL CORP", ticker: "INTC", exchange: "Nasdaq" },
  { cik: "0000019617", name: "JPMORGAN CHASE & CO", ticker: "JPM", exchange: "NYSE" },
  { cik: "0000070858", name: "BANK OF AMERICA CORP", ticker: "BAC", exchange: "NYSE" },
  { cik: "0000886982", name: "GOLDMAN SACHS GROUP INC", ticker: "GS", exchange: "NYSE" },
  { cik: "0000200406", name: "JOHNSON & JOHNSON", ticker: "JNJ", exchange: "NYSE" },
  { cik: "0000078003", name: "PFIZER INC", ticker: "PFE", exchange: "NYSE" },
  { cik: "0000059478", name: "ELI LILLY & Co", ticker: "LLY", exchange: "NYSE" },
  { cik: "0000310158", name: "MERCK & CO., INC.", ticker: "MRK", exchange: "NYSE" },
  { cik: "0000104169", name: "Walmart Inc.", ticker: "WMT", exchange: "NYSE" },
  { cik: "0000354950", name: "HOME DEPOT, INC.", ticker: "HD", exchange: "NYSE" },
  { cik: "0000021344", name: "COCA COLA CO", ticker: "KO", exchange: "NYSE" },
  { cik: "0000034088", name: "EXXON MOBIL CORP", ticker: "XOM", exchange: "NYSE" },
  { cik: "0000093410", name: "CHEVRON CORP", ticker: "CVX", exchange: "NYSE" },
  { cik: "0000018230", name: "CATERPILLAR INC", ticker: "CAT", exchange: "NYSE" },
  { cik: "0000012927", name: "BOEING CO", ticker: "BA", exchange: "NYSE" },
  { cik: "0000936468", name: "LOCKHEED MARTIN CORP", ticker: "LMT", exchange: "NYSE" },
  { cik: "0001341439", name: "ORACLE CORP", ticker: "ORCL", exchange: "NYSE" },
];
