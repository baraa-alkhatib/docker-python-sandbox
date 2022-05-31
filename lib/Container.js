"use strict";

const _ = require("lodash");
const async = require("async");
const request = require("request");
const fs = require("fs-extra");
const log = require("winston");

/*
 * A class representing a Docker container.
 *
 * The "instance" field corresponds to a Dockerode container instance
 */
class Container {
  constructor(id, instance) {
    this.id = id;
    this.instance = instance;
    this.ip = "";
    this.hostPort = "";
    this.cleanedUp = false;
  }

  /*
   * Executes a job inside the container
   */
  executeJob(job, cb) {
    const options = {
      url: `http://${this.hostPort ? "127.0.0.1:" : this.ip}${
        this.hostPort || ":3000"
      }/${job.type}`,
      timeout: job.payload.timeoutMs + 500,
    };

    if (job.payload.file) {
      options.formData = {
        file: fs.createReadStream(job.payload.file.path),
        timeout: options.timeout,
      };

      options.headers = {
        "Content-Type": "multipart/form-data",
      };

      // get a buffer from request
      options.encoding = null;
    } else {
      options.json = true;
      options.body = job.payload;
    }

    request.post(options, (err, res, body) => {
      if (err) {
        if (err.code === "ETIMEDOUT") {
          return cb(null, {
            timedOut: true,
            isError: true,
            stderr: "",
            stdout: "",
            combined: "",
          });
        }
        return cb(new Error("unable to contact container: " + err));
      }

      if (!res || !res.body)
        return cb(new Error("empty response from container"));

      cb(null, res);
    });
  }

  instance() {
    return this.instance;
  }

  setIp(ip) {
    if (ip) {
      this.ip = ip;
    }
  }

  setHostPort(port) {
    if (port) {
      this.hostPort = port;
    }
  }

  /*
   * Cleans up the resources used by the container.
   */
  cleanup(cb) {
    if (this.cleanedUp === true) {
      return async.nextTick(cb);
    }

    const stages = [
      /*
       * Stop the container
       */
      this.instance.stop.bind(this.instance),

      /*
       * Remove the container
       */
      this.instance.remove.bind(this.instance, { force: true }),

      /*
       * Mark the container as cleaned up
       */
      (next) => {
        this.cleanedUp = true;
        async.nextTick(next);
      },
    ];

    async.series(stages, cb);
  }
}

module.exports = Container;
