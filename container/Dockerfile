FROM node:14-alpine

WORKDIR /usr/src/app

RUN ["adduser",  "--home",  "/usr/src/app", "--system", "sandboxuser"]
RUN ["chown", "-R", "sandboxuser", "/usr/src/app"]
RUN ["chmod", "-R", "u+rwx", "/usr/src/app"]

COPY ./shared .
RUN npm i

COPY ./start.sh ./

RUN chmod 755 ./start.sh

RUN apk update

EXPOSE 3000

# Install python/pip
ENV PYTHONUNBUFFERED=1
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools

CMD [ "sh", "./start.sh" ] 
