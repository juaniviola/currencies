'use strict'

const { google } = require('googleapis')
const fs = require('fs')
const readline = require('readline')
const utils = require('util')
const cheerio = require('cheerio')
const rp = require('request-promise')
const readFile = utils.promisify(fs.readFile)

const TOKEN_PATH = 'token.json'
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets']
const spreadsheetId = process.env.SPREEDSHEET_ID
const dollarUrl = process.env.DOLLAR_URL
const bitcoinUrl = process.env.BITCOIN_URL
const ethereumUrl = process.env.ETHEREUM_URL

const readCredentials = async () => {
  try {
    const data = await readFile('credentials.json')
    await authorize(JSON.parse(data))
  } catch (err) {
    console.error(err)
  }
}

const authorize = async credentials => {
  const { client_secret, client_id, redirect_uris } = credentials.installed
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0])

  try {
    const token = await readFile(TOKEN_PATH)
    oAuth2Client.setCredentials(JSON.parse(token))
    await listData(oAuth2Client)
  } catch (err) {
    await getNewToken(oAuth2Client)
  }
}

const getNewToken = async oAuth2Client => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  })

  console.log('url:', authUrl)
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question('code: ', async code => {
    rl.close()

    const getToken = utils.promisify(oAuth2Client)
    const writeFile = utils.promisify(fs.writeFile)

    try {
      const token = await getToken(code)
      oAuth2Client.setCredentials(token)
      await writeFile(TOKEN_PATH, JSON.stringify(token))
      await listData(oAuth2Client)
    } catch (err) {
      console.error(err)
    }
  })
}

const listData = async auth => {
  const sheets = google.sheets({ version: 'v4', auth })
  const append = utils.promisify(sheets.spreadsheets.values.append)
  const range = process.env.RANGE

  try {
    /* get data of sheet */
    const bitcoin = await getBitcoin()
    const ethereum = await getEthereum()
    const dolar = await getDolar()

    /* append data to sheet */
    await append({
      spreadsheetId,
      range, // A1 notation
      resource: {
        values: [ [ date(), dolar, bitcoin, ethereum ] ]
      },
      valueInputOption: 'USER_ENTERED',
    })
  } catch (err) {
    console.error(err.message)
  }
}

const getBitcoin = async () => {
  try {
    const result = await rp(bitcoinUrl)
    const $ = cheerio.load(result)

    return $('span', '#quote_price').text().split('USD').join('')
  } catch (err) {
    console.error(err)
  }
}

const getEthereum = async () => {
  try {
    const result = await rp(ethereumUrl)
    const $ = cheerio.load(result)
  
    return $('span', '#quote_price').text().split('USD').join('')
  } catch (err) {
    console.error(err)
  }
}

const getDolar = async () => {
  try {
    const result = await rp(dollarUrl)
    const $ = cheerio.load(result)
  
    return $('#cc-ratebox').text().split('ARS/USD = ').join('').slice(0, 5).replace(',', '.')
  } catch (err) {
    console.error(err)
  }
}

const date = () => `${new Date().getDate()}/${new Date().getMonth()+1}/${new Date().getFullYear()}`

module.exports.hello = async (event, context) => {
  await readCredentials()

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Andando de 10 papito',
      input: event,
    }),
  };
};
