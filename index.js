const express = require("express");
const app = express();
require("dotenv").config();
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_KEY);
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const classesCollection = client.db("CreativeSnap").collection("classes");
    const cardsCollection = client.db("CreativeSnap").collection("cards");
    const paymentsCollection = client.db("CreativeSnap").collection("payments");

    // jwt sign validation
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_KEY, {
        expiresIn: "10h",
      });
      res.send({ token });
    });
    // user api collection
    // set users
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
    // get all users
    app.get("/users", verifyJWT, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // get role
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    app.get("/instructors", async (req, res) => {
      const filter = { role: "instructor" };
      try {
        const result = await usersCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    app.get("/instructors/popular", async (req, res) => {
      const filter = { role: "instructor" };
      const sort = { sell_count: -1 };
      try {
        const result = await usersCollection.find(filter).sort(sort).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
      }
    });

    // make admin
    app.patch("/users/admin/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    // make instructor
    app.patch("/users/instructor/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/users/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // classes api collection

    app.post("/classes", verifyJWT, async (req, res) => {
      const body = req.body;
      const result = await classesCollection.insertOne(body);
      res.send(result);
    });
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    app.get("/classes/popular", async (req, res) => {
      const sort = { sell_count: -1 };
      const result = await classesCollection.find().sort(sort).toArray();
      res.send(result);
    });

    // cards api collection

    app.post("/cards", verifyJWT, async (req, res) => {
      const body = req.body;
      const result = await cardsCollection.insertOne(body);
      res.send(result);
    });

    app.get("/cards/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { user_email: email };
      const result = await cardsCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/cards/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cardsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/cards/single/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cardsCollection.findOne(query);
      res.send(result);
    });

    // create payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price) * 100;

      if (isNaN(amount)) {
        res.status(400).send({ error: "Invalid price value" });
        return;
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: "Payment Intent creation failed" });
      }
    });

    // payment api collection

    app.post("/payment", verifyJWT, async (req, res) => {
      const body = req.body;
      const result = await paymentsCollection.insertOne(body);
      const query = { _id: new ObjectId(body.itemId) };
      const deleted = await cardsCollection.deleteOne(query);
      const instructor_email = body.instructor_email;
      const filter = { email: instructor_email };
      const options = { upsert: true };
      let availableSeats = parseInt(body.Available_seats);

      if (availableSeats <= 0) {
        return res
          .status(400)
          .json({ error: "No available seats for this project." });
      }

      availableSeats--;

      const updateDoc = {
        $set: {
          Available_seats: availableSeats,
        },
        $inc: { sell_count: 1 },
      };

      const classesUpdate = await classesCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      const userUpdate = await usersCollection.updateOne(
        filter,
        { $inc: { sell_count: 1 } },
        options
      );

      res.json({ result, deleted, classesUpdate, userUpdate });
    });

    app.get("/payment/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const sort = { date: -1 };
      const result = await paymentsCollection.find(query).sort(sort).toArray();
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
