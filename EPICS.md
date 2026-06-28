# EPICS

User and Role Management
1. For user management, i want to have 3 roles: sales rep, owner and admin
2. As an admin, i want to be able to assign roles to users using their gmail
3. As a user, i want to use my email to use the system.
4. As an admin, i want to be able to create roles based on the features we have, define CRUD (+ key action) permissions which i can assign to a role, then assign a role to a user. (3 roles above ship as built-in defaults; custom roles extend them.)

Subscription Management
1. As a Rep/Owner, I want to create new subscription for new clients
2. As a Rep/Owner, I want to see my created subscription entries.
3. As a Rep/Owner, I want to be able to update details of my created subscription
4. As an Owner, I want to be able to delete wrong subscription entries created by owner/rep

Payment Confirmation
1. As a Rep/Owner, I want to mark subscription and record payment details. Subscription can be grouped in a weekly basis since this is a weekly meal plan. I should be able to assign a subscription to a group in which the default value is the current week
2. As an owner, I want to be able to transition payment status to verified.
3. As an owner, I want to be able to modify/revert back the status of payment

Product Details
1. As an owner, I want to be able to create/update/delete products that will be used in subscription details

Invoice
1. As an owner, I should be able to create an invoice based on the subscription details

Dashboard
1. As an owner, I want to be able to see the totals in the dashboard of subscription/payments.
2. As an owner, I want to be able to see a list of unpaid customers or uncollected payments and their totals
2. As an owner, I should be able to see all listed subscriptions and search thru the details by customent name or product availed

Customer Management
1. As a Rep/Owner, I want returning clients saved so I can pull their details from a past subscription instead of re-typing them.
2. As a Rep/Owner, when creating a subscription I want to look up and attach an existing client (or create a new one), so the form prefills their saved details.
3. As an Owner, I want a Customers screen where I can browse all clients and view each client's subscription history (and payment history).
