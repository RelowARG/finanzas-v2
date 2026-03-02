FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
# El flag --host es vital para que Docker permita ver la web desde afuera
CMD ["npm", "run", "dev", "--", "--host"]