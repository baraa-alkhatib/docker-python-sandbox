FROM node:14-alpine

WORKDIR /usr/src/app

RUN ["adduser",  "--home",  "/usr/src/app", "--system", "sandboxuser"]
RUN ["chown", "-R", "sandboxuser", "/usr/src/app"]
RUN ["chmod", "-R", "u+rwx", "/usr/src/app"]

RUN apk update

EXPOSE 3000

# Install libreoffice
RUN apk add libreoffice

# Install the necessary fonts for libreoffice
RUN apk add --no-cache msttcorefonts-installer fontconfig
RUN update-ms-fonts

# Google fonts
RUN wget https://github.com/google/fonts/archive/main.tar.gz -O gf.tar.gz --no-check-certificate
RUN tar -xf gf.tar.gz
RUN mkdir -p /usr/share/fonts/truetype/google-fonts
RUN find $PWD/fonts-main/ -name "*.ttf" -exec install -m644 {} /usr/share/fonts/truetype/google-fonts/ \; || return 1
RUN rm -f gf.tar.gz
RUN fc-cache -f && rm -rf /var/cache/*


# Install poppler
RUN apk add poppler-utils

# Install python/pip
ENV PYTHONUNBUFFERED=1
RUN apk add --update --no-cache python3 && ln -sf python3 /usr/bin/python
RUN python3 -m ensurepip
RUN pip3 install --no-cache --upgrade pip setuptools

# Install pdf2image
RUN pip install pdf2image

# Copy src files
COPY ./shared .

# Change the owner of the app direcotry (run recursively)
RUN ["chown", "-R", "sandboxuser", "/usr/src/app"]
RUN ["chmod", "-R", "u+rwx", "/usr/src/app"]

# Run npm install
RUN npm i

# Copy entry file start.sh
COPY ./start.sh ./

# Change access permissions on start.sh
RUN chmod 755 ./start.sh

# Execute start.sh
CMD [ "sh", "./start.sh" ] 
