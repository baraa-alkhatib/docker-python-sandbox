var express = require("express");
var bodyParser = require("body-parser");
var fs = require("fs-extra");

var JSZip = require("jszip");

var libre = require("libreoffice-convert");

libre.convertAsync = require("util").promisify(libre.convert);

var child_process = require("child_process");
var _ = require("underscore");

var path = require("path");

var app = express();

var port = process.env.PORT || 3000;

var multer = require("multer");

var storage = multer.diskStorage({
  destination: path.join(__dirname, "/uploads/"),
  filename: function (req, file, cb) {
    // append extension
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

var upload = multer({
  storage: storage,
  dest: path.join(__dirname, "/uploads/"),
});

app.use(bodyParser.json());

app.get("/", function (req, res) {
  res.status(200).send("Container connected!");
});

app.post("/execute-python", function (req, res) {
  res.setHeader("Content-Type", "application/json");

  if (!req.body.code || !req.body.timeoutMs) {
    res.status(400);
    res.end(
      JSON.stringify({
        error: "no code or timeout specified",
      })
    );
  } else {
    res.status(200);

    var entryFileName = "code.py";

    if (_.isArray(req.body.code)) {
      const codeArr = req.body.code;
      codeArr.forEach((c) => {
        fs.writeFileSync(`./${c.fileName}`, c.code);
      });

      entryFileName = codeArr[0].fileName;

      if (entryFileName.endsWith("evaluate.py")) {
        fs.appendFileSync(
          `./${entryFileName}`,
          `\nif __name__ == '__main__':\nunittest.main()`
        );
      }
    } else {
      // Write code to file
      fs.writeFileSync(`./${entryFileName}`, req.body.code);
    }

    var executor = req.body.v3 === true ? "python3" : "python";

    var job = child_process.spawn(executor, ["-u", `${entryFileName}`], {
      cwd: __dirname,
    });
    var output = {
      stdout: "",
      stderr: "",
      combined: "",
    };

    job.stdout.on("data", function (data) {
      output.stdout += data;
      output.combined += data;
    });

    job.stderr.on("data", function (data) {
      output.stderr += data;
      output.combined += data;
    });

    job.on("error", console.error);

    // Timeout logic
    var timeoutCheck = setTimeout(function () {
      console.error("Process timed out. Killing");
      job.kill("SIGKILL");
      var result = _.extend(output, {
        timedOut: true,
        isError: true,
        killedByContainer: true,
      });
      res.end(JSON.stringify(result));
    }, req.body.timeoutMs);

    job.on("close", function (exitCode) {
      var result = _.extend(output, {
        isError: exitCode != 0,
      });
      res.end(JSON.stringify(result));
      clearTimeout(timeoutCheck);
    });
  }
});

app.post(
  "/convert-document-to-images",
  upload.single("file"),
  async function (req, res) {
    // check if request has an uploaded file
    if (!req.file) {
      return res.status(400).end(
        JSON.stringify({
          error: "file required",
        })
      );
    }

    const uploadDir = path.join(__dirname, "/uploads");

    // create images directory
    const imagesDir = path.join(__dirname, "/images");

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir);
    }
    // cleanup code
    res.on("finish", function () {
      try {
        fs.emptyDirSync(uploadDir);
        fs.emptyDirSync(imagesDir);
      } catch (err) {
        console.error(err);
      }
    });

    // Timeout logic
    var timeoutCheck;

    if (req.body.timeout) {
      timeoutCheck = setTimeout(function () {
        console.error("Process timed out. Killing");

        job.kill("SIGKILL");

        var result = _.extend(output, {
          timedOut: true,
          isError: true,
          killedByContainer: true,
        });

        res.status(500).json(result);
      }, Number(req.body.timeout));
    }

    // define convert pdf to jpg function
    function convertPdfToJPGJob() {
      // convert pdf to images
      var convertjob = child_process.spawn(
        "python",
        ["./scripts/pdf-2-image.py"],
        {
          cwd: __dirname,
        }
      );

      convertjob.on("error", console.error);

      convertjob.on("close", async function (exitCode) {
        try {
          clearTimeout(timeoutCheck);

          const result = {
            isError: exitCode != 0,
          };

          if (result.isError) {
            res.status(500).json(result);
          } else {
            const zip = new JSZip();

            // read the saved (jpg) image files
            const fileNames = await fs.promises.readdir(
              path.join(__dirname, "images"),
              ["**.jpg"]
            );

            fileNames.forEach(function (filename) {
              const filepath = path.join(__dirname, "images", filename);

              const data = fs.readFileSync(filepath);

              // append files to zip
              zip.file(filename, data);
            });

            zip.generateAsync({ type: "base64" }).then((base64) => {
              let zip = Buffer.from(base64, "base64");
              res.writeHead(200, {
                "Content-Type": "application/zip",
                "Content-disposition": `attachment; filename=images.zip`,
              });

              res.end(zip);
            });
          }
        } catch (err) {
          console.error("err on close: ", err);
        }
      });
    }

    // if the uploaded file is already a pdf, convert to jpg
    if (req.file.mimetype === "application/pdf") {
      convertPdfToJPGJob();
      return;
    }

    try {
      // if the provided file is e.g. MS DOCS, convert to pdf first then jpg
      const files = fs.readdirSync(path.join(__dirname, "/uploads"));

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];

        // TODO: enhance this check to include all office documents
        if (path.extname(file) !== "pdf") {
          const inputPath = path.join(__dirname, `/uploads/${file}`);

          const outputPath = path.join(
            __dirname,
            `/uploads/${path.parse(file).name}.pdf`
          );

          // read file
          const docxBuf = await fs.promises.readFile(inputPath);

          // convert it to pdf format with undefined filter (see Libreoffice docs about filter)
          const pdfBuf = await libre.convertAsync(docxBuf, ".pdf", undefined);

          // here in done you have pdf file which you can save or transfer in another stream
          await fs.writeFile(outputPath, pdfBuf);

          convertPdfToJPGJob();
        }
      }
    } catch (err) {
      const result = {
        isError: exitCode != 0,
        error: err,
      };

      res.status(500).json(result);
    }
  }
);

app.listen(port, function () {
  console.log("Container service running on port " + port);
});
