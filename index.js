const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .state(401)
      .send({ error: true, message: "Invalid authorization" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_KEY, (err, decoded) => {
    if (err) {
      return res
        .state(401)
        .send({ error: true, message: "Invalid authorization" });
    }
    res.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.h54g5oh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db("CreativeSnap").collection("users");

    // jwt sign validation
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_KEY, {
        expiresIn: "10h",
      });
      res.send({ token });
    });
    // user api collection
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running ...............");
});

app.listen(port, () => {
  console.log(`server listening on port ${port}`);
});
