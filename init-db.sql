-- Enable Mixed Mode Authentication (SQL Server and Windows Authentication)
USE [master];
GO

-- Ensure the 'sa' login is enabled and set with a strong password
ALTER LOGIN [sa] ENABLE;
GO
ALTER LOGIN [sa] WITH PASSWORD = 'MakanBakso123'; -- Match the password in the environment variables
GO

-- Create a new database
CREATE DATABASE SampleDB;
GO

-- Switch to the new database
USE SampleDB;
GO

-- Create a Customers table
CREATE TABLE Customers (
    CustomerID INT PRIMARY KEY IDENTITY(1,1),
    FirstName NVARCHAR(50),
    LastName NVARCHAR(50),
    Email NVARCHAR(100)
);
GO

-- Create a Products table
CREATE TABLE Products (
    ProductID INT PRIMARY KEY IDENTITY(1,1),
    ProductName NVARCHAR(100),
    Price DECIMAL(10,2),
    CategoryID INT
);
GO

-- Create a Categories table
CREATE TABLE Categories (
    CategoryID INT PRIMARY KEY IDENTITY(1,1),
    CategoryName NVARCHAR(50) NOT NULL,
    Description NVARCHAR(200)
);
GO

-- Create a PaymentMethods table
CREATE TABLE PaymentMethods (
    PaymentMethodID INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(50) NOT NULL,
    Description NVARCHAR(200)
);
GO

-- Create an OrderStatuses table
CREATE TABLE OrderStatuses (
    StatusID INT PRIMARY KEY IDENTITY(1,1),
    StatusName NVARCHAR(50) NOT NULL,
    Description NVARCHAR(200)
);
GO

-- Create an Addresses table
CREATE TABLE Addresses (
    AddressID INT PRIMARY KEY IDENTITY(1,1),
    CustomerID INT NOT NULL,
    Street NVARCHAR(100) NOT NULL,
    City NVARCHAR(50) NOT NULL,
    State NVARCHAR(50),
    PostalCode NVARCHAR(20),
    Country NVARCHAR(50) NOT NULL,
    AddressType NVARCHAR(20) NOT NULL, -- 'Billing', 'Shipping', 'Primary'
    IsPrimary BIT DEFAULT 0,
    CONSTRAINT FK_Addresses_Customers FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    CONSTRAINT CHK_AddressType CHECK (AddressType IN ('Billing', 'Shipping', 'Primary'))
);
GO

-- Create an Orders table
CREATE TABLE Orders (
    OrderID INT PRIMARY KEY IDENTITY(1,1),
    CustomerID INT NOT NULL,
    OrderDate DATETIME NOT NULL DEFAULT GETDATE(),
    RequiredDate DATETIME,
    ShippedDate DATETIME,
    PaymentMethodID INT NOT NULL,
    StatusID INT NOT NULL,
    ShippingAddressID INT,
    BillingAddressID INT,
    TotalAmount DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerID) REFERENCES Customers(CustomerID),
    CONSTRAINT FK_Orders_PaymentMethods FOREIGN KEY (PaymentMethodID) REFERENCES PaymentMethods(PaymentMethodID),
    CONSTRAINT FK_Orders_Statuses FOREIGN KEY (StatusID) REFERENCES OrderStatuses(StatusID),
    CONSTRAINT FK_Orders_ShippingAddress FOREIGN KEY (ShippingAddressID) REFERENCES Addresses(AddressID),
    CONSTRAINT FK_Orders_BillingAddress FOREIGN KEY (BillingAddressID) REFERENCES Addresses(AddressID),
    CONSTRAINT CHK_RequiredDate CHECK (RequiredDate >= OrderDate),
    CONSTRAINT CHK_ShippedDate CHECK (ShippedDate >= OrderDate)
);
GO

-- Create an OrderItems table
CREATE TABLE OrderItems (
    OrderItemID INT PRIMARY KEY IDENTITY(1,1),
    OrderID INT NOT NULL,
    ProductID INT NOT NULL,
    Quantity INT NOT NULL,
    UnitPrice DECIMAL(10,2) NOT NULL,
    Discount DECIMAL(5,2) DEFAULT 0,
    CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderID) REFERENCES Orders(OrderID),
    CONSTRAINT FK_OrderItems_Products FOREIGN KEY (ProductID) REFERENCES Products(ProductID),
    CONSTRAINT CHK_Quantity CHECK (Quantity > 0),
    CONSTRAINT CHK_Discount CHECK (Discount BETWEEN 0 AND 1)
);
GO

-- Insert sample data into Customers
INSERT INTO Customers (FirstName, LastName, Email) VALUES
    ('John', 'Doe', 'john.doe@email.com'),
    ('Jane', 'Smith', 'jane.smith@email.com'),
    ('Bob', 'Johnson', 'bob.johnson@email.com'),
    ('Alice', 'Brown', 'alice.brown@email.com'),
    ('Michael', 'Johnson', 'michael.johnson@email.com'),
    ('Sarah', 'Williams', 'sarah.williams@email.com'),
    ('David', 'Brown', 'david.brown@email.com'),
    ('Emily', 'Davis', 'emily.davis@email.com'),
    ('James', 'Wilson', 'james.wilson@email.com'),
    ('Linda', 'Taylor', 'linda.taylor@email.com'),
    ('Robert', 'Anderson', 'robert.anderson@email.com'),
    ('Mary', 'Thomas', 'mary.thomas@email.com'),
    ('William', 'Jackson', 'william.jackson@email.com'),
    ('Patricia', 'White', 'patricia.white@email.com');
GO

-- Insert sample data into Categories
INSERT INTO Categories (CategoryName, Description) VALUES
    ('Electronics', 'Electronic devices and accessories'),
    ('Computers', 'Laptops, desktops, and computer components'),
    ('Mobile Devices', 'Smartphones and tablets'),
    ('Audio', 'Headphones, speakers, and audio equipment'),
    ('Accessories', 'Cables, chargers, and other accessories'),
    ('Peripherals', 'Computer peripherals and accessories'),
    ('Software', 'Software products and licenses'),
    ('Gaming', 'Gaming hardware and accessories'),
    ('Office Supplies', 'Office equipment and supplies'),
    ('Networking', 'Networking equipment and accessories');
GO

-- Insert sample data into Products
INSERT INTO Products (ProductName, Price, CategoryID) VALUES
    ('Laptop', 999.99, 2),
    ('Smartphone', 699.99, 3),
    ('Headphones', 149.99, 4),
    ('Mouse', 29.99, 1),
    ('Keyboard', 49.99, 1),
    ('External Hard Drive', 89.99, 1),
    ('Gaming Headset', 199.99, 4),
    ('Laptop Charger', 39.99, 5),
    ('Smartwatch', 299.99, 3),
    ('Wireless Earbuds', 79.99, 4),
    ('Gaming Keyboard', 129.99, 3),
    ('Mechanical Keyboard', 199.99, 1),
    ('Wireless Mouse', 49.99, 1),
    ('Laptop Backpack', 59.99, 5),
    ('USB Hub', 29.99, 1),
    ('External SSD', 129.99, 1),
    ('Gaming Chair', 299.99, 3),
    ('Office Chair', 199.99, 4),
    ('Desking Lamp', 49.99, 4),
    ('Surge Protector', 29.99, 5),
    ('Office Desk', 399.99, 4),
    ('Gaming Desktop', 1299.99, 2),
    ('Business Laptop', 1499.99, 2),
    ('Gaming Laptop', 1799.99, 2),
    ('Office Printer', 199.99, 4),
    ('Laser Printer', 299.99, 4);
GO

-- Insert sample data into PaymentMethods
INSERT INTO PaymentMethods (Name, Description) VALUES
    ('Credit Card', 'Credit card payment'),
    ('Debit Card', 'Debit card payment'),
    ('Bank Transfer', 'Bank transfer payment'),
    ('Cash on Delivery', 'Cash payment upon delivery'),
    ('PayPal', 'PayPal payment'),
    ('Apple Pay', 'Apple Pay payment'),
    ('Google Pay', 'Google Pay payment'),
    ('Direct Debit', 'Direct debit payment'),
    ('Cash', 'Cash payment');
GO

-- Insert sample data into OrderStatuses
INSERT INTO OrderStatuses (StatusName, Description) VALUES
    ('Pending', 'Order is pending'),
    ('Processing', 'Order is being processed'),
    ('Shipped', 'Order has been shipped'),
    ('Delivered', 'Order has been delivered'),
    ('Cancelled', 'Order has been cancelled'),
    ('Partially Shipped', 'Some items have been shipped'),
    ('Backordered', 'Item is backordered'),
    ('On Hold', 'Order is on hold'),
    ('Awaiting Payment', 'Waiting for payment'),
    ('Awaiting Fulfillment', 'Order is being prepared');
GO

-- Insert sample data into Addresses
INSERT INTO Addresses (CustomerID, Street, City, State, PostalCode, Country, AddressType, IsPrimary) VALUES
    (1, '123 Main St', 'Los Angeles', 'CA', '90001', 'USA', 'Primary', 1),
    (1, '456 Billing Ave', 'Los Angeles', 'CA', '90001', 'USA', 'Billing', 0),
    (2, '789 Market St', 'San Francisco', 'CA', '94103', 'USA', 'Primary', 1),
    (3, '1011 Pine St', 'Seattle', 'WA', '98101', 'USA', 'Primary', 1),
    (4, '1213 Oak Ave', 'Portland', 'OR', '97201', 'USA', 'Primary', 1),
    (5, '1234 Elm St', 'New York', 'NY', '10001', 'USA', 'Primary', 1),
    (5, '5678 Oak Ave', 'New York', 'NY', '10001', 'USA', 'Billing', 0),
    (6, '9101 Pine St', 'Chicago', 'IL', '60601', 'USA', 'Primary', 1),
    (7, '1213 Maple Ave', 'Houston', 'TX', '77001', 'USA', 'Primary', 1),
    (8, '1415 Birch St', 'Phoenix', 'AZ', '85001', 'USA', 'Primary', 1),
    (9, '1617 Cedar Ave', 'Philadelphia', 'PA', '19101', 'USA', 'Primary', 1),
    (10, '1819 Walnut St', 'San Antonio', 'TX', '78201', 'USA', 'Primary', 1),
    (11, '2021 Spruce Ave', 'San Diego', 'CA', '92101', 'USA', 'Primary', 1),
    (12, '2223 Oak St', 'Dallas', 'TX', '75201', 'USA', 'Primary', 1),
    (13, '2425 Pine Ave', 'San Jose', 'CA', '95101', 'USA', 'Primary', 1);
GO

-- Insert sample data into Orders
INSERT INTO Orders (CustomerID, RequiredDate, PaymentMethodID, StatusID, ShippingAddressID, BillingAddressID, TotalAmount) VALUES
    (1, DATEADD(DAY, 7, GETDATE()), 1, 1, 1, 2, 1049.98),
    (2, DATEADD(DAY, 5, GETDATE()), 2, 1, 3, 3, 949.98),
    (3, DATEADD(DAY, 3, GETDATE()), 1, 1, 4, 4, 749.97),
    (4, DATEADD(DAY, 10, GETDATE()), 3, 1, 5, 5, 1249.97),
    (5, DATEADD(DAY, 5, GETDATE()), 1, 1, 11, 12, 1999.98),
    (6, DATEADD(DAY, 3, GETDATE()), 2, 1, 13, 13, 1249.97),
    (7, DATEADD(DAY, 7, GETDATE()), 3, 1, 14, 14, 1499.96),
    (8, DATEADD(DAY, 2, GETDATE()), 4, 1, 15, 15, 999.95),
    (9, DATEADD(DAY, 4, GETDATE()), 5, 1, 16, 16, 1799.94),
    (10, DATEADD(DAY, 6, GETDATE()), 6, 1, 17, 17, 1599.93),
    (11, DATEADD(DAY, 8, GETDATE()), 7, 1, 18, 18, 1399.92),
    (12, DATEADD(DAY, 10, GETDATE()), 8, 1, 19, 19, 1199.91),
    (13, DATEADD(DAY, 12, GETDATE()), 9, 1, 20, 20, 1999.90),
    (1, DATEADD(DAY, -2, GETDATE()), 1, 3, 1, 2, 1049.98),
    (2, DATEADD(DAY, -5, GETDATE()), 2, 4, 3, 3, 949.98),
    (3, DATEADD(DAY, -1, GETDATE()), 3, 5, 4, 4, 749.97),
    (4, DATEADD(DAY, -3, GETDATE()), 4, 6, 5, 5, 1249.97),
    (5, DATEADD(DAY, -7, GETDATE()), 5, 7, 11, 12, 1999.98);
GO

-- Insert sample data into OrderItems
INSERT INTO OrderItems (OrderID, ProductID, Quantity, UnitPrice, Discount) VALUES
    (1, 1, 1, 999.99, 0.1),
    (1, 4, 1, 29.99, 0),
    (2, 2, 1, 699.99, 0.1),
    (2, 5, 1, 49.99, 0),
    (3, 3, 1, 149.99, 0.1),
    (3, 6, 1, 89.99, 0),
    (4, 7, 1, 199.99, 0.1),
    (4, 8, 1, 39.99, 0),
    (4, 9, 1, 299.99, 0),
    (5, 11, 1, 1299.99, 0.1),
    (5, 12, 1, 1499.99, 0.1),
    (6, 13, 1, 1799.99, 0.1),
    (6, 14, 1, 199.99, 0.1),
    (7, 15, 1, 299.99, 0.1),
    (7, 16, 1, 399.99, 0.1),
    (8, 17, 1, 499.99, 0.1),
    (8, 18, 1, 599.99, 0.1),
    (9, 19, 1, 699.99, 0.1),
    (9, 20, 1, 799.99, 0.1),
    (10, 21, 1, 899.99, 0.1),
    (10, 22, 1, 999.99, 0.1),
    (11, 23, 1, 1099.99, 0.1),
    (11, 24, 1, 1199.99, 0.1),
    (12, 25, 1, 1299.99, 0.1),
    (12, 26, 1, 1399.99, 0.1),
    (13, 27, 1, 1499.99, 0.1),
    (13, 28, 1, 1599.99, 0.1),
    (14, 29, 1, 1699.99, 0.1),
    (14, 30, 1, 1799.99, 0.1),
    (15, 1, 1, 999.99, 0.1),
    (15, 4, 1, 29.99, 0),
    (16, 2, 1, 699.99, 0.1),
    (16, 5, 1, 49.99, 0),
    (17, 3, 1, 149.99, 0.1),
    (17, 6, 1, 89.99, 0),
    (18, 7, 1, 199.99, 0.1),
    (18, 8, 1, 39.99, 0),
    (18, 9, 1, 299.99, 0),
    (19, 10, 1, 79.99, 0.1);
GO

-- Create indexes for better query performance
CREATE INDEX IX_Orders_CustomerID ON Orders(CustomerID);
CREATE INDEX IX_OrderItems_OrderID ON OrderItems(OrderID);
CREATE INDEX IX_OrderItems_ProductID ON OrderItems(ProductID);
CREATE INDEX IX_Products_CategoryID ON Products(CategoryID);
CREATE INDEX IX_Addresses_CustomerID ON Addresses(CustomerID);
GO

-- Create views for common queries
CREATE VIEW v_CustomerOrders AS
SELECT 
    c.CustomerID,
    c.FirstName,
    c.LastName,
    o.OrderID,
    o.OrderDate,
    o.TotalAmount,
    os.StatusName as OrderStatus,
    pm.Name as PaymentMethod,
    a.Street,
    a.City,
    a.State,
    a.PostalCode,
    a.Country
FROM Customers c
JOIN Orders o ON c.CustomerID = o.CustomerID
JOIN OrderStatuses os ON o.StatusID = os.StatusID
LEFT JOIN PaymentMethods pm ON o.PaymentMethodID = pm.PaymentMethodID
LEFT JOIN Addresses a ON o.ShippingAddressID = a.AddressID;
GO

CREATE VIEW v_OrderDetails AS
SELECT 
    o.OrderID,
    o.OrderDate,
    o.TotalAmount,
    oi.ProductID,
    p.ProductName,
    p.Price as OriginalPrice,
    c.CategoryName,
    oi.Quantity,
    oi.UnitPrice,
    oi.Discount,
    (oi.Quantity * oi.UnitPrice * (1 - oi.Discount)) as LineTotal,
    (oi.Quantity * oi.UnitPrice * oi.Discount) as DiscountAmount
FROM Orders o
JOIN OrderItems oi ON o.OrderID = oi.OrderID
JOIN Products p ON oi.ProductID = p.ProductID
JOIN Categories c ON p.CategoryID = c.CategoryID;
GO