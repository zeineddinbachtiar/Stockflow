export interface CustomerRecord {
  id: string;
  customer_code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface PublicCustomer {
  id: string;
  customerCode: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerInput {
  customerCode: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface UpdateCustomerInput {
  customerCode?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}
