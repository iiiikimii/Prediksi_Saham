/**
 * Definisi 167 Emiten Saham Bursa Efek Indonesia (BEI/IDX)
 * Berdasarkan 4 Sektor Strategis: Perbankan, Makanan, Perkebunan, Mineral
 */

const SEKTOR_SAHAM = {
    "Perbankan": [
        "BBCA", "BBRI", "BMRI", "BBNI", "BRIS", "BBTN", "BNGA", "BDMN",
        "NISP", "PNBN", "BNLI", "BNII", "MEGA", "BTPN", "BTPS",
        "BJBR", "BJTM", "BEKS", "ARTO", "BBYB", "BBHI", "AGRO", "BANK",
        "AMAR", "BBSI", "BACA", "BABP", "BBKP", "BCIC", "BGTG", "BINA",
        "BKSW", "BMAS", "BNBA", "BBMD", "BSIM", "BSWD", "BVIC", "DNAR",
        "INPC", "MASB", "MAYA", "MCOR", "NOBU", "PNBS", "SDRA", "AGRS"
    ],
    "Makanan": [
        "ICBP", "INDF", "MYOR", "ROTI", "GOOD", "STTP", "SKLT", "SKBM",
        "CEKA", "CAMP", "KEJU", "HOKI", "BUDI", "AISA", "ALTO", "COCO",
        "FOOD", "IKAN", "PSDN", "PMMP", "ENZO", "BOBA", "NASI", "TAYS",
        "GULA", "TRGU", "WAPO", "CMRY", "ULTJ", "CLEO", "ADES", "MLBI",
        "DLTA", "BEER", "WINE", "DMND", "SOUL", "TGUK", "CPIN", "JPFA",
        "MAIN", "WMUU", "BEEF", "CPRO", "DSFI", "CRAB", "PCAR", "SIPD",
        "AMMS", "DEWI", "ISEA", "AGAR"
    ],
    "Perkebunan": [
        "AALI", "LSIP", "TAPG", "DSNG", "SSMS", "SIMP", "SGRO", "STAA",
        "TBLA", "SMAR", "NSSS", "BWPT", "GZCO", "JAWA", "ANJT", "CSRA",
        "FAPA", "MGRO", "PGUN", "PNGO", "PSGO", "UNSP", "JARR", "CBUT",
        "MKTR", "TLDN", "OILS", "PTPS", "PALM", "GOLL", "MAGP", "BISI",
        "ANDI", "FISH"
    ],
    "Mineral": [
        "AMMN", "ANTM", "INCO", "MDKA", "MBMA", "NCKL", "TINS", "BRMS",
        "PSAB", "ARCI", "NICL", "NICE", "DKFT", "IFSH", "CITA", "ZINC",
        "SQMI", "SMGA", "HRUM", "CUAN", "KRAS", "ISSP", "GGRP", "INAI",
        "ALKA", "ALMI", "GDST", "BAJA", "NIKL", "LION", "TBMS", "KBLI",
        "VOKS", "IKBI"
    ]
};

const TICKER_TO_SECTOR = {};
for (const [sektor, tickers] of Object.entries(SEKTOR_SAHAM)) {
    for (const t of tickers) {
        TICKER_TO_SECTOR[t] = sektor;
    }
}

module.exports = {
    SEKTOR_SAHAM,
    TICKER_TO_SECTOR
};
