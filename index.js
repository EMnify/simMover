#!/usr/bin/env node
'use strict';

const program = require('commander');
const request = require('request');
const throttledRequest = require('throttled-request')(request);
const fs = require('fs');
const path = require('path');

throttledRequest.configure({
  requests: 2,
  milliseconds: 1000
}); //This will throttle the requests so no more than 3 are made every second

program
  .version('1.1.0')
  .option('-i, --imsiList [list of imsis]', 'IMSIs to be moved like 123456789123456,223456789123456')
  .option('-f, --imsiCsvFile [path]', 'Path to a file that contains a comma seperated list of IMSIs in UTF-8 encoding without a headline')
  .option('-o, --destinationOrgId [orgId]', 'Destination organisation ID to move them to')
  .option('-d, --dryRun', 'Output changes without applying executing them live')
  .option('-t, --appToken [token]', 'Application token for authorisation')
  .parse(process.argv);

const API_URL = "https://cdn.emnify.net/api/v1";
const APP_TOKEN = program.appToken;
let auth_token;

if (APP_TOKEN) {
  request.post(API_URL + "/authenticate", {
    body: {
      "application_token": APP_TOKEN
    },
    json: true
  }, function (err, res, body) {
    if (err) {
      return console.error("Error authenticating with the application token", err);
    }
    if (res.statusCode === 200) {
      console.log("Successfully authenticated using the application token");
      auth_token = body.auth_token;
      readImsis();
    } else {
      return console.error("Errorcode", res.statusCode, "occured while authenticating");
    }
  });
}

function readImsis() {
  let imsis;
  if (program.imsiCsvFile) {
    const filePath = path.join(__dirname, program.imsiCsvFile);
    fs.readFile(filePath, {
      encoding: 'utf-8'
    }, function (err, csvContent) {
      if (!err) {
        imsis = csvContent.split(',');
        console.log("Sucessfully read the CSV file with the content", imsis);
        getSimIdsFromImsis(imsis);
      } else {
        console.log(err);
      }
    });
  } else if (program.imsiList) {
    imsis = program.imsiList.split(',');
    getSimIdsFromImsis(imsis);
  }
}

function getSimIdsFromImsis(imsis) {
  let imsiProcessed = 0;
  (function () {
    let arrayOfSimIds = [];
    imsis.forEach(function (imsi, index, array) {
      //TODO query EMnify API for SIM ID by ICCID
      throttledRequest(API_URL + "/sim?page=1&per_page=2&q=imsi:" + imsi, {
        'auth': {
          'bearer': auth_token
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          return console.error("Error getting the SIM for", imsi, err);
        }
        if (!body.length) {
          return console.error("IMSI", imsi, "matches no SIM.");
        }
        if (body.length > 1) {
          return console.error("IMSI", imsi, "matches more than one SIM.");
        }
        if (res.statusCode === 200) {
          let simId = body[0].id;
          arrayOfSimIds.push(simId);
          console.log('sim ID for', imsi, 'is', simId);
          imsiProcessed++;
          if (imsiProcessed === array.length) {
            updateAllSimsOrgId(arrayOfSimIds);
          }
        }
        else {
          return console.error("Errorcode", res.statusCode, "occured while getting SIM with IMSI", imsi);
        }
      });
    });
  })();
}

function updateAllSimsOrgId(simIds) {
  let simsProcessed = 0;
  simIds.forEach(function (simId, index, array) {
    if (program.dryRun) {
      console.log('DRY RUN: Update simId', simId, 'to organisation', program.destinationOrgId);
    }
    else {
      throttledRequest({
        method: 'PATCH',
        uri: API_URL + "/sim/" + simId,
        auth: {
          bearer: auth_token
        },
        body: {
          customer_org: {
            id: program.destinationOrgId
          },
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          return console.error("Error patching the SIM for simId", simId, err);
        }
        if (res.statusCode === 200) {
          console.log('Update simId', simId, 'to organisation', program.destinationOrgId);
          simsProcessed++;
          if (simsProcessed === array.length) {
            console.log("All completed");
          }
        }
        else {
          return console.error("Errorcode", res.statusCode, "occured while updating SIMid", simId);
        }
      });
    }
  });
}