#!/usr/bin/env node

'use strict';

const Promise = require('promise');
const request = require('request');
const throttledRequest = require('throttled-request')(request);
const inquirer = require("inquirer");
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

throttledRequest.configure({
  requests: 2,
  milliseconds: 1000
}); //This will throttle the requests so no more than 3 are made every second

const API_URL = "https://cdn.emnify.net/api/v1";
const simStatuses = {
  issued: 0,
  activated: 1,
  suspended: 2,
  deleted: 3
}

const askQuestions = () => {
  const questions = [{
      name: "DRYRUN",
      type: "confirm",
      message: "Do you want to do a dry run (test run) without applying any changes for now?"
    },
    {
      name: "IDENTIFIER",
      type: "list",
      message: "How do you identify the sim cards?",
      choices: ["by iccid", "by imsi", "by simid"],
      filter: function (val) {
        return val.split(" ")[1];
      }
    },
    {
      name: "FILEPATH",
      type: "input",
      message: "What's the path of the CSV file with all the sims listed? Please make sure it does not have a header!",
      default: "sample.csv"
    },
    {
      name: "DESTORGID",
      type: "input",
      message: "What's the organisation id of the organisation you want to move the sim cards to?",
      validate: function (val) {
        let num = Number(val);
        if (num > 0)
          return true
        else {
          return "Please enter a valid organisation id."
        }
      }
    },
    {
      name: "STATUS",
      type: "list",
      message: "To which status should the sims be set when they are moved?",
      choices: ["Leave the status untouched", "Set it to activated", "Set it to suspended"],
      filter: function (val) {
        return val.split(" ")[3];
      }
    },
    {
      name: "MASTERTOKEN",
      type: "password",
      message: "Please give an application token of the managing organisation that wants to move SIM cards from one organisation to another one.",
      validate: function (val) {
        if (jwt.decode(val)) {
          return true;
        } else {
          return "Please enter a valid application token."
        }
      }
    },
    {
      name: "ENTERPRISETOKEN",
      type: "password",
      message: "Please give an application token of the enterprise where the SIM cards are currently residing so they can be unlinked from the endpoints there.",
      validate: function (val) {
        if (val)
          return true
        else {
          return "Please enter the application token."
        }
      }
    },
  ];
  return inquirer.prompt(questions);
};

const unlinkSimsFromEndpoints = (arrayOfSimIds, masterToken, enterpriseToken, dryRun) => {
  return new Promise((resolve, reject) => {
    if (arrayOfSimIds.length < 1) {
      let t = jwt.decode(masterAuthToken);
      console.log("Are you sure these SIM cards belong to " + t["esc.orgName"] + "(" + t["esc.org"] + ")?");
      resolve(true);
    }
    console.log("Fetching connected endpoints to release attached SIMs...");
    let promises = [];
    for (let i = 1; i <= arrayOfSimIds.length; i++) {
      let simId = arrayOfSimIds[i-1];
      throttledRequest(API_URL + "/sim/" + simId, {
        'auth': {
          'bearer': masterToken
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          console.log("Error getting the endpoint for simId", simid, err, body);
        } else if (!body.endpoint) {
          console.log("SIM", simId, "is not connected to an endpoint - proceeding");
        } else if (res.statusCode === 200) {
          console.log('SIM', simId, 'is connected to', body.endpoint.id, 'releasing it...');
          promises.push(unlinkSim(body.endpoint.id, simId, enterpriseToken, dryRun));
        } else {
          console.log("Errorcode", res.statusCode, "occured while getting endpoint for SIM", simId, body);
        }
        if (i === arrayOfSimIds.length) {
          if (promises.length > 0) {
            Promise.all(promises)
              .then(data => {
                resolve(true);
              });
          } else {
            resolve(true);
          }
        }
      });
    };
  });
};

const unlinkSim = (endpointId, simId, enterpriseToken, dryRun) => {
  return new Promise((resolve, reject) => {
    if (dryRun) {
      console.log('DRY RUN: Would have released sim from endpoint', endpointId);
    } else {
      throttledRequest({
        method: 'PATCH',
        uri: API_URL + "/endpoint/" + endpointId,
        auth: {
          bearer: enterpriseToken
        },
        body: {
          sim: {
            id: null
          }
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          console.log("Error releasing the SIM for endpoint", endpointId, err, body);
        } else if (res.statusCode === 204) {
          console.log('Released sim', simId, 'from endpoint ', endpointId);
          resolve(true);
        } else {
          console.log("Errorcode", res.statusCode, "occured while updating endpoint", endpointId, body);
        }
      });
    }
  });
}

const authenticate = (token) => {
  return new Promise((resolve, reject) => {
    let t = jwt.decode(token);
    console.log("Authenticating user " + t["sub"] + " of organisation " + t["esc.orgName"] + "(" + t["esc.org"] + ")...");
    request.post(API_URL + "/authenticate", {
      body: {
        "application_token": token
      },
      json: true
    }, function (err, res, body) {
      if (err) {
        console.log("Error authenticating", t["sub"], err, body);
      }
      if (res.statusCode === 200) {
        console.log("Successfully authenticated", t["sub"]);
        resolve(body.auth_token);
      } else {
        console.log("Errorcode", res.statusCode, "occured while authenticating", t["sub"], body);
      }
    });
  });
}

function readCsvFile(filePathString) {
  return new Promise((resolve, reject) => {
    console.log("Reading the CSV file from", filePathString + "...")
    let filePath = path.join(filePathString);
    fs.readFile(filePath, {
      encoding: 'utf-8'
    }, function (err, csvContent) {
      if (!err) {
        csvContent = csvContent.replace(/(\s\r\n|\n|\r|\s)/gm, "");
        let list = csvContent.split(',');
        console.log("Sucessfully processed the CSV file with", list.length, "sims");
        resolve(list);
      } else {
        console.log("Error processing the CSV file, here's the content:", list);
        reject(err);
      }
    });
  });
}

const getArrayOfSimIds = (identifiers, type, masterToken) => {
  return new Promise((resolve, reject) => {
    let t = jwt.decode(masterToken);
    console.log("Fetching SIM IDs for provided", type + "s...");
    if (type === "simid") {
      resolve(identifiers);
    };
    let identifiersProcessed = 0;
    let arrayOfSimIds = [];
    identifiers.forEach(function (id, index, array) {
      throttledRequest(API_URL + "/sim?page=1&per_page=2&q=" + type + ":" + id, {
        'auth': {
          'bearer': masterToken
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          console.log("Error getting the SIM for", type, id, err, body);
        } else if (!body.length) {
          console.log(type, id, "matches no SIM of" + t["esc.orgName"] + "(" + t["esc.org"] + ")");
        } else if (body.length > 1) {
          console.log(type, id, "matches more than one SIM, are you sure the", type, "is complete?");
        } else if (res.statusCode === 200) {
          arrayOfSimIds.push(body[0].id);
          console.log('SIM ID for', type, id, 'is', body[0].id);
        } else {
          console.log("Errorcode", res.statusCode, "occured while getting SIM with", type, id, body);
        }
        identifiersProcessed++;
        if (identifiersProcessed === array.length) {
          resolve(arrayOfSimIds);
        }
      });
    });
  });
}

const updateAllSimsOrgId = (simIds, orgId, status, masterToken, dryRun) => {
  return new Promise((resolve, reject) => {
    console.log("Updating SIMs to organisation", orgId, "and the status", status+"...");
    let simsProcessed = 0;
    simIds.forEach(function (simId, index, array) {
      if (dryRun) {
        console.log('DRY RUN: Would have updated simId', simId, 'to organisation', orgId, 'and set status to', status);
        resolve(true);
      } else {

        let body = {
          'customer_org': {
            'id': parseInt(orgId)
          }
        };

        if (status !== "untouched") {
          body.status = {
            'id': parseInt(simStatuses[status])
          }
        };

        throttledRequest({
          method: 'PATCH',
          uri: API_URL + "/sim/" + simId,
          'auth': {
            'bearer': masterToken
          },
          'body': body,
          json: true
        }, function (err, res, body) {
          if (err) {
            console.log("Error updating simId", simId, err, body);
          } else if (res.statusCode === 204) {
            console.log('Updated simId', simId, 'to organisation', orgId, 'and set status to', status);
          } else {
            console.log("Errorcode", res.statusCode, "occured while updating SIM with id", simId, body);
          }
          simsProcessed++;
          if (simsProcessed === array.length) {
            console.log("All done, great!");
            resolve(true);
          }
        });
      }
    });
  });
}

const run = async () => {
  try {
    const answers = await askQuestions();
    const masterAuthToken = await authenticate(answers.MASTERTOKEN);
    const enterpriseAuthToken = await authenticate(answers.ENTERPRISETOKEN);
    const listOfIdentifiers = await readCsvFile(answers.FILEPATH);
    const arrayOfSimIds = await getArrayOfSimIds(listOfIdentifiers, answers.IDENTIFIER, masterAuthToken);
    const success = await unlinkSimsFromEndpoints(arrayOfSimIds, masterAuthToken, enterpriseAuthToken, answers.DRYRUN);
    updateAllSimsOrgId(arrayOfSimIds, answers.DESTORGID, answers.STATUS, masterAuthToken, answers.DRYRUN);
  } catch (err) {
    console.error(err);
  };
};

run();