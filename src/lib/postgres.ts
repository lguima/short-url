import postgres from 'postgres';

export const sql = postgres('postgresql://docker:pw00@localhost:5432/shorturl');
