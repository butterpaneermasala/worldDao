import React from 'react';
import Head from 'next/head';
import Landing from '@/components/Landing';
import Layout from '@/components/Layout';

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>worldDao</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Layout>
        <Landing />
      </Layout>
    </>
  );
}
