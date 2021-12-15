var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var child_process = require('child_process');
var _ = require('underscore');

var app = express();

var port = process.env.PORT || 3000;

app.use(bodyParser.json());

app.get('/', function(req, res) {
	res.status(200).send('Container connected!');
})

app.post('/', function (req, res) {
    
    res.setHeader('Content-Type', 'application/json');
    
  	if (!req.body.code || !req.body.timeoutMs) {
        res.status(400);
        res.end(JSON.stringify({error: "no code or timeout specified"}));
  	}
  	else {
  	    res.status(200);

			var entryFileName = 'code.py';
    
			if (_.isArray(req.body.code)) {
				const codeArr = req.body.code;
				codeArr.forEach(c => {
					fs.writeFileSync(`./${c.fileName}`, c.code);
				});

				entryFileName = codeArr[0].fileName;

				if (entryFileName.endsWith('evaluate.py')) {
					fs.appendFileSync(`./${entryFileName}`, `\n
if __name__ == '__main__':
    unittest.main()
					`)
				}
			} else {
				// Write code to file
				fs.writeFileSync(`./${entryFileName}`, req.body.code);
			}


			var executor = (req.body.v3 === true) ? "python3" : "python";

			var job = child_process.spawn(executor, ["-u", `${entryFileName}`], { cwd: __dirname });
  		var output = {stdout: '', stderr: '', combined: ''};

  		
  		job.stdout.on('data', function (data) {
  		    output.stdout += data;
  		    output.combined += data;
  		})
  		
  		job.stderr.on('data', function (data) {
  		    output.stderr += data;
  		    output.combined += data;
  		})
  	
			job.on('error', console.error);

    	// Timeout logic
  		var timeoutCheck = setTimeout(function () {
  		    console.error("Process timed out. Killing")
  		    job.kill('SIGKILL');
  		    var result = _.extend(output, { timedOut: true, isError: true, killedByContainer: true });
  		    res.end(JSON.stringify(result));
  		}, req.body.timeoutMs)
  		
  		job.on('close', function (exitCode) {
  		   var result = _.extend(output, { isError: exitCode != 0 })
  		   res.end(JSON.stringify(result));
  		   clearTimeout(timeoutCheck);
  		});
  	
  	}
});

app.listen(port, function () {
	console.log('Container service running on port '+port);
});