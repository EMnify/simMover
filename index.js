#!/usr/bin/env node

'use strict';

const Promise = require('promise');
const request = require('request');
const throttledRequest = require('throttled-request')(request);
const inquirer = require("inquirer");
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
      choices: ["activated", "suspended", "issued", "deleted"]
    },
    {
      name: "MASTERTOKEN",
      type: "password",
      message: "Please give an application token of the managing organisation that wants to move SIM cards from one organisation to another one.",
      validate: function (val) {
        if (val)
          return true
        else {
          return "Please enter the application token."
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

const getArrayOfEndpointIdsPerSim = (arrayOfSimIds, masterToken) => {
  return new Promise((resolve, reject) => {
    let simsProcessed = 0;
    let arrayOfEndpointIds = [];

    arrayOfSimIds.forEach(function (simId, index, array) {
      throttledRequest(API_URL + "/sim/" + simId, {
        'auth': {
          'bearer': masterToken
        },
        json: true
      }, function (err, res, body) {
        if (err) {
          console.log("Error getting the endpoint for simId", simid, err, body);
        } else if (!body.endpoint) {
          console.log("SIM", simId, "is not connected to an endpoint");
          resolve([]);
        } else if (res.statusCode === 200) {
          let endpointId = body.endpoint.id;
          arrayOfEndpointIds.push(endpointId);
          console.log('SIM', simId, 'is connected to', endpointId);
        } else {
          console.log("Errorcode", res.statusCode, "occured while getting endpoint for SIM", simId, body);
        }
        simsProcessed++;
        if (simsProcessed === array.length) {
          resolve(arrayOfEndpointIds);
        }
      });
    });
  });
}

const releaseSimsFromEndpoints = (endpointIds, enterpriseToken) => {
  return new Promise((resolve, reject) => {
    let endpointsProcessed = 0;
    endpointIds.forEach(function (endpointId, index, array) {
      if (program.dryRun) {
        console.log('DRY RUN: Release sim from endpoint', endpointId);
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
            console.log('Released sim from endpoint', endpointId);
          } else {
            console.log("Errorcode", res.statusCode, "occured while updating endpoint", endpointId, body);
          }
          endpointsProcessed++;
          if (endpointsProcessed === array.length) {
            resolve(true);
          }
        });
      }
    });
  });
}

const authenticate = (token) => {
  return new Promise((resolve, reject) => {
    request.post(API_URL + "/authenticate", {
      body: {
        "application_token": token
      },
      json: true
    }, function (err, res, body) {
      if (err) {
        console.log("Error authenticating with the application token", err, body);
      }
      if (res.statusCode === 200) {
        console.log("Successfully authenticated using the application token");
        resolve(body.auth_token);
      } else {
        console.log("Errorcode", res.statusCode, "occured while authenticating", body);
      }
    });
  });
}

function readCsvFile(filePathString) {
  return new Promise((resolve, reject) => {
    let filePath = path.join(filePathString);
    fs.readFile(filePath, {
      encoding: 'utf-8'
    }, function (err, csvContent) {
      if (!err) {
        csvContent = csvContent.replace(/(\s\r\n|\n|\r|\s)/gm, "");
        let list = csvContent.split(',');
        console.log("Sucessfully read the CSV file with the content", list);
        resolve(list);
      } else {
        reject(err);
      }
    });
  });
}

const getArrayOfSimIds = (identifiers, type, masterToken) => {
  return new Promise((resolve, reject) => {
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
          console.log(type, id, "matches no SIM.");
        } else if (body.length > 1) {
          console.log(type, id, "matches more than one SIM.");
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

const updateAllSimsOrgId = (simIds, masterToken) => {
  return new Promise((resolve, reject) => {
    let simsProcessed = 0;
    simIds.forEach(function (simId, index, array) {
      if (program.dryRun) {
        console.log('DRY RUN: Would have updated simId', simId, 'to organisation', program.destinationOrgId, 'and set status to', program.setStatus);
        resolve(true);
      } else {
        throttledRequest({
          method: 'PATCH',
          uri: API_URL + "/sim/" + simId,
          'auth': {
            'bearer': masterToken
          },
          'body': {
            'status': {
              'id': parseInt(simStatuses[program.setStatus.toLowerCase()])
            },
            'customer_org': {
              'id': parseInt(program.destinationOrgId)
            }
          },
          json: true
        }, function (err, res, body) {
          if (err) {
            console.log("Error patching the SIM for simId", simId, err, body);
          } else if (res.statusCode === 204) {
            console.log('Updated simId', simId, 'to organisation', program.destinationOrgId, 'and set status to', program.setStatus);
          } else {
            console.log("Errorcode", res.statusCode, "occured while updating SIMid", simId, body);
          }
          simsProcessed++;
          if (simsProcessed === array.length) {
            console.log("All completed");
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
    console.log("after questions", answers);

    const masterAuthToken = await authenticate(answers.MASTERTOKEN);
    const enterpriseAuthToken = await authenticate(answers.ENTERPRISETOKEN);
    const listOfIdentifiers = await readCsvFile(answers.FILEPATH);
    console.log("After readCsvFile", listOfIdentifiers);
    const arrayOfSimIds = await getArrayOfSimIds(listOfIdentifiers, answers.IDENTIFIER, masterAuthToken);

    let ready = false;
    if (arrayOfSimIds.length > 0) {
      const endpointIds = await getArrayOfEndpointIdsPerSim(arrayOfSimIds, masterAuthToken);
      ready = await releaseSimsFromEndpoints(endpointIds, enterpriseAuthToken);
    } else {
      ready = true
    }
    if (ready) {
      updateAllSimsOrgId(arrayOfSimIds, masterAuthToken);
    }
  } catch (err) {
    console.error(err);
  };
};

run();