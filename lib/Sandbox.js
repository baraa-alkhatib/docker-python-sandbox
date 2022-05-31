"use strict";

let _           = require('lodash')
let async       = require('async')
let Container   = require('./Container')
let PoolManager = require('./PoolManager')
let Job         = require('./Job')
let fs          = require('fs-extra')
let log         = require('winston')
var Docker      = require('dockerode')

const defaultOptions = {
  "poolSize": 1,
  "memoryLimitMb": 50, 
  "imageName": "professphysics/docker-sandbox",
  "timeoutMs": 10000
};

const noop = () => {}

class Sandbox {
    
  constructor(options) {
      this.options = _.defaults(options, defaultOptions)
      
      this.options.containerLaunchOptions = {
        "Image": this.options.imageName,
        "NetworkDisabled": false, 
        "AttachStdin": false,
        "AttachStdout": false,
        "AttachStderr": false,
        "OpenStdin": false, 
        "Privileged": false,
        "User": "sandboxuser",
        "Tty": false,
        "HostConfig": {
            "AutoRemove": true,
            "Memory": this.options.memoryLimitMb * 1000000, 
            "MemorySwap": -1,
            "Privileged": false, 
            "CpusetCpus": "0" // only use one core
        }, 
        "Labels": {
          "__docker_sandbox": "1"
        },
        ExposedPorts: {
          "3000/tcp": {}
        }
      };
      
      this.docker  = new Docker()
      this.manager = new PoolManager(this.docker, options)
      
      const cleanupEvents = ['beforeExit', 'SIGINT']
      const cleanupFn = this.cleanup.bind(this, true)
      cleanupEvents.map(event => {
        process.on(event, cleanupFn)
      });
      
  }
  
  /*
   * Initializes the sandbox by creating the pool of
   * containers
   */
  initialize(cb) {
    this.manager.initialize(this.options.poolSize, cb)
  }
  
  /*
   * Runs the specifed job
   */
  run(type, payload, cb) {
    payload.timeoutMs = payload.timeoutMs || this.options.timeoutMs;

    const code = payload.code;

    if (type !== 'execute-python'
      && type !== 'convert-document-to-images') {
        throw new Error(
          "Please provide a valid job type"
        );
    }

    if (
      type === 'execute-python' &&
      (!code ||
        (!_.isString(code) &&
          (!_.isArray(code) ||
            !_.every(
              code,
              (c) => _.isString(c.fileName) && _.isString(c.code)
            ))))
    ) {
      throw new Error(
        "Please provide the code to run as a string or an array [{ fileName: '', code: 'xxx' }]"
      );
    }

    const job = new Job(type, payload, cb)
    this.manager.executeJob(job)
  }
  
      
  /* 
   *  Cleanups various resources such as temporary
   *  files and docker containers
   */
  cleanup(cb) {
    log.debug("cleaning up")
    
    if (typeof cb === 'boolean') {
      cb = null
      var exit = true;
    }
    else {
      cb = cb || _.noop
    }
    
    this.manager.cleanup( err => {
      if (cb) return cb(err)
      else if (exit) process.exit();
    })
  }
  
}

module.exports = Sandbox
module.exports.defaultOptions = defaultOptions
