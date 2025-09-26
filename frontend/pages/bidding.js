import React from 'react';
import Head from 'next/head';
import Bidding from '@/components/Bidding';
import Layout from '@/components/Layout';

export default function BiddingPage() {
  return (
    <>
      <Head>
        <title>worldDao • Bidding</title>
      </Head>
      <Layout>
        <Bidding />
      </Layout>
    </>
  );
}
